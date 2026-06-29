import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { hasRole } from "@/lib/auth";
import { createMovementCode } from "@/lib/enterprise-codes";
import { writeAudit } from "@/lib/audit";

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "DEALER"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  const warehouseWhere = auth.user.role === "DEALER"
    ? { dealer: { dealerCode: auth.user.dealerCode || "__NONE__" } }
    : {};

  const [items, warehouses, movements, dealers] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.warehouse.findMany({
      where: warehouseWhere,
      include: { dealer: { select: { dealerCode: true, name: true } }, balances: { include: { item: true } } },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.stockMovement.findMany({
      where: auth.user.role === "DEALER" ? {
        OR: [
          { fromWarehouse: { dealer: { dealerCode: auth.user.dealerCode || "__NONE__" } } },
          { toWarehouse: { dealer: { dealerCode: auth.user.dealerCode || "__NONE__" } } },
        ],
      } : {},
      include: { item: true, fromWarehouse: true, toWarehouse: true, serviceOrder: { select: { orderCode: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    ["ADMIN", "SUPER_ADMIN"].includes(auth.user.role)
      ? prisma.dealer.findMany({ where: { status: "APPROVED" }, select: { id: true, dealerCode: true, name: true, province: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  const totals = warehouses
    .flatMap((w: { balances: { quantity: number; reserved: number; item: { costPrice: number; minStock: number } }[] }) => w.balances)
    .reduce(
      (acc: { quantity: number; reserved: number; value: number; lowStock: number }, balance: { quantity: number; reserved: number; item: { costPrice: number; minStock: number } }) => {
        acc.quantity += balance.quantity;
        acc.reserved += balance.reserved;
        acc.value += balance.quantity * balance.item.costPrice;
        if (balance.quantity <= balance.item.minStock) acc.lowStock += 1;
        return acc;
      },
      { quantity: 0, reserved: 0, value: 0, lowStock: 0 },
    );

  return NextResponse.json({ success: true, data: { items, warehouses, movements, dealers, totals } });
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được thay đổi kho." }, { status: 403 });

  try {
    const body = await request.json();
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "CREATE_ITEM") {
      const sku = String(body.sku || "").trim().toUpperCase();
      const name = String(body.name || "").trim();
      const category = String(body.category || "").trim();
      if (!sku || !name || !category) return NextResponse.json({ success: false, message: "Thiếu mã, tên hoặc nhóm vật tư." }, { status: 400 });
      const item = await prisma.inventoryItem.create({ data: {
        sku, name, category, unit: String(body.unit || "cái").trim() || "cái",
        minStock: Math.max(0, number(body.minStock)), costPrice: Math.max(0, number(body.costPrice)), salePrice: Math.max(0, number(body.salePrice)),
      } });
      await writeAudit({ request, userId: auth.user.id, action: "CREATE_INVENTORY_ITEM", target: item.sku, detail: item });
      return NextResponse.json({ success: true, message: "Đã thêm vật tư.", data: item }, { status: 201 });
    }

    if (action === "CREATE_WAREHOUSE") {
      const code = String(body.code || "").trim().toUpperCase();
      const name = String(body.name || "").trim();
      if (!code || !name) return NextResponse.json({ success: false, message: "Thiếu mã hoặc tên kho." }, { status: 400 });
      const warehouse = await prisma.warehouse.create({ data: {
        code, name, type: String(body.type || "CENTRAL"), dealerId: body.dealerId || null,
        province: body.province || null, address: body.address || null,
      } });
      await writeAudit({ request, userId: auth.user.id, action: "CREATE_WAREHOUSE", target: warehouse.code, detail: warehouse });
      return NextResponse.json({ success: true, message: "Đã tạo kho.", data: warehouse }, { status: 201 });
    }

    if (action === "MOVE_STOCK") {
      const type = String(body.type || "").toUpperCase();
      const itemId = String(body.itemId || "");
      const fromWarehouseId = body.fromWarehouseId ? String(body.fromWarehouseId) : null;
      const toWarehouseId = body.toWarehouseId ? String(body.toWarehouseId) : null;
      const quantity = number(body.quantity);
      const unitCost = Math.max(0, number(body.unitCost));
      if (!itemId || quantity <= 0 || !["IN", "OUT", "TRANSFER", "ADJUST_IN", "ADJUST_OUT", "SERVICE_USE"].includes(type)) {
        return NextResponse.json({ success: false, message: "Thông tin phiếu kho không hợp lệ." }, { status: 400 });
      }
      if (["OUT", "ADJUST_OUT", "SERVICE_USE", "TRANSFER"].includes(type) && !fromWarehouseId) {
        return NextResponse.json({ success: false, message: "Cần chọn kho xuất." }, { status: 400 });
      }
      if (["IN", "ADJUST_IN", "TRANSFER"].includes(type) && !toWarehouseId) {
        return NextResponse.json({ success: false, message: "Cần chọn kho nhập." }, { status: 400 });
      }
      if (type === "TRANSFER" && fromWarehouseId === toWarehouseId) {
        return NextResponse.json({ success: false, message: "Kho xuất và kho nhận phải khác nhau." }, { status: 400 });
      }

      const movementCode = await createMovementCode();
          const movement = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        if (fromWarehouseId) {
          const source = await tx.stockBalance.findUnique({ where: { warehouseId_itemId: { warehouseId: fromWarehouseId, itemId } } });
          if (!source || source.quantity - source.reserved < quantity) throw new Error("Tồn khả dụng không đủ để xuất.");
          await tx.stockBalance.update({ where: { id: source.id }, data: { quantity: { decrement: quantity } } });
        }
        if (toWarehouseId) {
          await tx.stockBalance.upsert({
            where: { warehouseId_itemId: { warehouseId: toWarehouseId, itemId } },
            create: { warehouseId: toWarehouseId, itemId, quantity },
            update: { quantity: { increment: quantity } },
          });
        }
        return tx.stockMovement.create({ data: {
          movementCode, type, itemId, fromWarehouseId, toWarehouseId,
          serviceOrderId: body.serviceOrderId || null, quantity, unitCost,
          note: typeof body.note === "string" ? body.note.trim() || null : null,
          createdById: auth.user.id,
        }, include: { item: true, fromWarehouse: true, toWarehouse: true } });
      });
      await writeAudit({ request, userId: auth.user.id, action: "MOVE_STOCK", target: movementCode, detail: { type, itemId, quantity, fromWarehouseId, toWarehouseId } });
      return NextResponse.json({ success: true, message: "Đã ghi nhận phiếu kho.", data: movement }, { status: 201 });
    }

    return NextResponse.json({ success: false, message: "Hành động không hợp lệ." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không cập nhật được kho.";
    console.error("POST /api/inventory failed", error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
