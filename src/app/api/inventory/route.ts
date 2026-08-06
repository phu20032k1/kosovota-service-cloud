import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { createMovementCode } from "@/lib/enterprise-codes";
import { writeAudit } from "@/lib/audit";
import { databaseErrorMessage } from "@/lib/database-errors";

const WAREHOUSE_TYPES = new Set(["CENTRAL", "REGIONAL", "DEALER"]);
const MOVEMENT_TYPES = new Set(["IN", "OUT", "TRANSFER", "ADJUST_IN", "ADJUST_OUT", "SERVICE_USE"]);
const INBOUND_TYPES = new Set(["IN", "ADJUST_IN"]);
const OUTBOUND_TYPES = new Set(["OUT", "ADJUST_OUT", "SERVICE_USE"]);

class InventoryError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "InventoryError";
    this.status = status;
  }
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function prismaCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
}

async function serializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (prismaCode(error) === "P2034" && attempt < 2) continue;
      throw error;
    }
  }

  throw new InventoryError("Kho đang có giao dịch đồng thời. Vui lòng thử lại.", 409);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await hasRole(request, ["SUPER_ADMIN", "ADMIN", "DEALER"]);
    if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

    const dealerCode = auth.user.dealerCode || "__NONE__";
    const warehouseWhere = auth.user.role === "DEALER"
      ? { active: true, dealer: { dealerCode } }
      : { active: true };

    const [items, warehouses, movements, dealers] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { active: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
      prisma.warehouse.findMany({
        where: warehouseWhere,
        include: {
          dealer: { select: { dealerCode: true, name: true } },
          balances: { include: { item: true }, orderBy: { item: { name: "asc" } } },
        },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      }),
      prisma.stockMovement.findMany({
        where: auth.user.role === "DEALER"
          ? {
              OR: [
                { fromWarehouse: { dealer: { dealerCode } } },
                { toWarehouse: { dealer: { dealerCode } } },
              ],
            }
          : {},
        include: {
          item: true,
          fromWarehouse: true,
          toWarehouse: true,
          serviceOrder: { select: { orderCode: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      ["SUPER_ADMIN", "ADMIN"].includes(auth.user.role)
        ? prisma.dealer.findMany({
            where: { status: "APPROVED" },
            select: { id: true, dealerCode: true, name: true, province: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
    ]);

    const totals = warehouses
      .flatMap((warehouse) => warehouse.balances)
      .reduce(
        (accumulator, balance) => {
          accumulator.quantity += balance.quantity;
          accumulator.reserved += balance.reserved;
          accumulator.value += balance.quantity * balance.item.costPrice;
          if (balance.quantity <= balance.item.minStock) accumulator.lowStock += 1;
          return accumulator;
        },
        { quantity: 0, reserved: 0, value: 0, lowStock: 0 },
      );

    return NextResponse.json({ success: true, data: { items, warehouses, movements, dealers, totals } });
  } catch (error) {
    console.error("GET /api/inventory failed", error);
    return NextResponse.json(
      { success: false, message: databaseErrorMessage(error, "Không tải được dữ liệu kho.") },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["SUPER_ADMIN", "ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin hoặc Super Admin được thay đổi kho." }, { status: 403 });

  try {
    const body = await request.json().catch(() => ({}));
    const action = text(body.action).toUpperCase();

    if (action === "CREATE_ITEM") {
      const sku = text(body.sku).toUpperCase();
      const name = text(body.name);
      const category = text(body.category);
      const unit = text(body.unit) || "cái";

      if (!sku || !name || !category) throw new InventoryError("Thiếu mã, tên hoặc nhóm vật tư.");

      const item = await prisma.inventoryItem.create({
        data: {
          sku,
          name,
          category,
          unit,
          minStock: Math.max(0, number(body.minStock)),
          costPrice: Math.max(0, number(body.costPrice)),
          salePrice: Math.max(0, number(body.salePrice)),
        },
      });

      await writeAudit({ request, userId: auth.user.id, action: "CREATE_INVENTORY_ITEM", target: item.sku, detail: item });
      return NextResponse.json({ success: true, message: "Đã thêm vật tư.", data: item }, { status: 201 });
    }

    if (action === "CREATE_WAREHOUSE") {
      const code = text(body.code).toUpperCase();
      const name = text(body.name);
      const type = text(body.type).toUpperCase() || "CENTRAL";
      const dealerId = type === "DEALER" ? text(body.dealerId) : "";

      if (!code || !name) throw new InventoryError("Thiếu mã hoặc tên kho.");
      if (!WAREHOUSE_TYPES.has(type)) throw new InventoryError("Loại kho không hợp lệ.");
      if (type === "DEALER" && !dealerId) throw new InventoryError("Kho đại lý phải gắn với một đại lý đã duyệt.");

      if (dealerId) {
        const dealer = await prisma.dealer.findFirst({
          where: { id: dealerId, status: "APPROVED" },
          select: { id: true },
        });
        if (!dealer) throw new InventoryError("Đại lý không tồn tại hoặc chưa được duyệt.");
      }

      const warehouse = await prisma.warehouse.create({
        data: {
          code,
          name,
          type,
          dealerId: dealerId || null,
          province: text(body.province) || null,
          address: text(body.address) || null,
        },
      });

      await writeAudit({ request, userId: auth.user.id, action: "CREATE_WAREHOUSE", target: warehouse.code, detail: warehouse });
      return NextResponse.json({ success: true, message: "Đã tạo kho.", data: warehouse }, { status: 201 });
    }

    if (action === "DELETE_ITEM") {
      const itemId = text(body.itemId);
      if (!itemId) throw new InventoryError("Thiếu vật tư cần xóa.");

      const item = await prisma.inventoryItem.findUnique({
        where: { id: itemId },
        include: {
          balances: { select: { id: true, quantity: true, reserved: true } },
          _count: { select: { movements: true } },
        },
      });
      if (!item) throw new InventoryError("Không tìm thấy vật tư.", 404);

      const hasStock = item.balances.some((balance) => balance.quantity !== 0 || balance.reserved !== 0);
      if (hasStock) throw new InventoryError("Vật tư vẫn còn tồn hoặc đang giữ chỗ. Hãy đưa tồn về 0 trước khi xóa.", 409);

      if (item._count.movements > 0) {
        await prisma.$transaction([
          prisma.stockBalance.deleteMany({ where: { itemId } }),
          prisma.inventoryItem.update({ where: { id: itemId }, data: { active: false } }),
        ]);
        await writeAudit({ request, userId: auth.user.id, action: "DEACTIVATE_INVENTORY_ITEM", target: item.sku, detail: { itemId } });
        return NextResponse.json({ success: true, message: "Vật tư đã có lịch sử giao dịch nên được ngừng sử dụng và ẩn khỏi danh mục." });
      }

      await prisma.inventoryItem.delete({ where: { id: itemId } });
      await writeAudit({ request, userId: auth.user.id, action: "DELETE_INVENTORY_ITEM", target: item.sku, detail: { itemId } });
      return NextResponse.json({ success: true, message: "Đã xóa vật tư." });
    }

    if (action === "DELETE_WAREHOUSE") {
      const warehouseId = text(body.warehouseId);
      if (!warehouseId) throw new InventoryError("Thiếu kho cần xóa.");

      const warehouse = await prisma.warehouse.findUnique({
        where: { id: warehouseId },
        include: {
          balances: { select: { id: true, quantity: true, reserved: true } },
          _count: { select: { outgoingMovements: true, incomingMovements: true } },
        },
      });
      if (!warehouse) throw new InventoryError("Không tìm thấy kho.", 404);

      const hasStock = warehouse.balances.some((balance) => balance.quantity !== 0 || balance.reserved !== 0);
      if (hasStock) throw new InventoryError("Kho vẫn còn tồn hoặc đang giữ chỗ. Hãy xuất hoặc điều chuyển hết hàng trước khi xóa.", 409);

      const movementCount = warehouse._count.outgoingMovements + warehouse._count.incomingMovements;
      if (movementCount > 0) {
        await prisma.$transaction([
          prisma.stockBalance.deleteMany({ where: { warehouseId } }),
          prisma.warehouse.update({ where: { id: warehouseId }, data: { active: false } }),
        ]);
        await writeAudit({ request, userId: auth.user.id, action: "DEACTIVATE_WAREHOUSE", target: warehouse.code, detail: { warehouseId } });
        return NextResponse.json({ success: true, message: "Kho đã có lịch sử giao dịch nên được ngừng hoạt động và ẩn khỏi danh sách." });
      }

      await prisma.warehouse.delete({ where: { id: warehouseId } });
      await writeAudit({ request, userId: auth.user.id, action: "DELETE_WAREHOUSE", target: warehouse.code, detail: { warehouseId } });
      return NextResponse.json({ success: true, message: "Đã xóa kho." });
    }

    if (action === "MOVE_STOCK") {
      const type = text(body.type).toUpperCase();
      const itemId = text(body.itemId);
      const fromWarehouseId = text(body.fromWarehouseId) || null;
      const toWarehouseId = text(body.toWarehouseId) || null;
      const serviceOrderId = text(body.serviceOrderId) || null;
      const quantity = number(body.quantity);
      const unitCost = Math.max(0, number(body.unitCost));

      if (!MOVEMENT_TYPES.has(type) || !itemId || quantity <= 0) throw new InventoryError("Thông tin phiếu kho không hợp lệ.");

      if (INBOUND_TYPES.has(type)) {
        if (!toWarehouseId) throw new InventoryError("Phiếu nhập cần chọn kho nhận.");
        if (fromWarehouseId) throw new InventoryError("Phiếu nhập không được chọn kho xuất.");
      } else if (OUTBOUND_TYPES.has(type)) {
        if (!fromWarehouseId) throw new InventoryError("Phiếu xuất cần chọn kho xuất.");
        if (toWarehouseId) throw new InventoryError("Phiếu xuất không được chọn kho nhận.");
      } else if (type === "TRANSFER") {
        if (!fromWarehouseId || !toWarehouseId) throw new InventoryError("Phiếu điều chuyển cần chọn cả kho xuất và kho nhận.");
        if (fromWarehouseId === toWarehouseId) throw new InventoryError("Kho xuất và kho nhận phải khác nhau.");
      }

      if (type === "SERVICE_USE" && !serviceOrderId) throw new InventoryError("Xuất dùng cho dịch vụ phải gắn với một lệnh dịch vụ.");

      const warehouseIds = [...new Set([fromWarehouseId, toWarehouseId].filter((value): value is string => Boolean(value)))];
      const [item, warehouses, serviceOrder] = await Promise.all([
        prisma.inventoryItem.findFirst({ where: { id: itemId, active: true } }),
        warehouseIds.length
          ? prisma.warehouse.findMany({ where: { id: { in: warehouseIds }, active: true }, select: { id: true } })
          : Promise.resolve([]),
        serviceOrderId
          ? prisma.serviceOrder.findUnique({ where: { id: serviceOrderId }, select: { id: true } })
          : Promise.resolve(null),
      ]);

      if (!item) throw new InventoryError("Vật tư không tồn tại hoặc đã ngừng sử dụng.", 404);
      if (warehouses.length !== warehouseIds.length) throw new InventoryError("Có kho không tồn tại hoặc đã ngừng hoạt động.", 404);
      if (serviceOrderId && !serviceOrder) throw new InventoryError("Lệnh dịch vụ không tồn tại.", 404);

      const movementCode = await createMovementCode();
      const movement = await serializableTransaction(async (tx) => {
        if (fromWarehouseId) {
          const source = await tx.stockBalance.findUnique({
            where: { warehouseId_itemId: { warehouseId: fromWarehouseId, itemId } },
          });
          const available = Math.max(0, (source?.quantity || 0) - (source?.reserved || 0));
          if (!source || available < quantity) throw new InventoryError(`Tồn khả dụng không đủ để xuất. Hiện còn ${available} ${item.unit}.`, 409);

          await tx.stockBalance.update({
            where: { id: source.id },
            data: { quantity: { decrement: quantity } },
          });
        }

        if (toWarehouseId) {
          await tx.stockBalance.upsert({
            where: { warehouseId_itemId: { warehouseId: toWarehouseId, itemId } },
            create: { warehouseId: toWarehouseId, itemId, quantity },
            update: { quantity: { increment: quantity } },
          });
        }

        return tx.stockMovement.create({
          data: {
            movementCode,
            type,
            itemId,
            fromWarehouseId,
            toWarehouseId,
            serviceOrderId,
            quantity,
            unitCost,
            note: text(body.note) || null,
            createdById: auth.user.id,
          },
          include: { item: true, fromWarehouse: true, toWarehouse: true },
        });
      });

      await writeAudit({
        request,
        userId: auth.user.id,
        action: "MOVE_STOCK",
        target: movementCode,
        detail: { type, itemId, quantity, fromWarehouseId, toWarehouseId, serviceOrderId },
      });

      return NextResponse.json({ success: true, message: "Đã ghi nhận phiếu kho.", data: movement }, { status: 201 });
    }

    throw new InventoryError("Hành động không hợp lệ.");
  } catch (error) {
    console.error("POST /api/inventory failed", error);

    if (error instanceof InventoryError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    const code = prismaCode(error);
    if (code === "P2002") {
      return NextResponse.json(
        { success: false, message: "Mã vật tư, mã kho hoặc kho đại lý đã tồn tại." },
        { status: 409 },
      );
    }
    if (code === "P2003") {
      return NextResponse.json(
        { success: false, message: "Dữ liệu liên kết không hợp lệ. Hãy kiểm tra lại vật tư, kho hoặc đại lý." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { success: false, message: databaseErrorMessage(error, "Không cập nhật được kho.") },
      { status: 500 },
    );
  }
}
