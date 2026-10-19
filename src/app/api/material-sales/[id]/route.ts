import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { createMovementCode } from "@/lib/enterprise-codes";
import { readMaterialSale, writeMaterialSale, materialSaleTotal, type MaterialSaleLine, type MaterialSaleOrder, type MaterialSaleStatus } from "@/lib/material-sale";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };
const STATUSES: MaterialSaleStatus[] = ["DRAFT", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];

class SaleError extends Error {
  constructor(message: string, public statusCode = 400) { super(message); }
}

async function getSaleTicket(id: string, role: string, provinceScope?: string | null) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: { machine: { select: { id: true, provinceCode: true } } },
  });
  if (!ticket || ticket.type !== "MATERIAL_SALE") throw new SaleError("Không tìm thấy yêu cầu bán lõi/vật liệu.", 404);
  if (role === "CSKH" && provinceScope) {
    const provinces = provinceScope.split(",").map((part) => part.trim()).filter(Boolean);
    if (provinces.length && (!ticket.machine?.provinceCode || !provinces.includes(ticket.machine.provinceCode))) {
      throw new SaleError("Yêu cầu nằm ngoài khu vực CSKH được phân công.", 403);
    }
  }
  return ticket;
}

function saleTicketStatus(status: MaterialSaleStatus, hasAssignee: boolean) {
  if (status === "DRAFT") return hasAssignee ? "ASSIGNED" : "NEW";
  if (status === "CONFIRMED") return "ASSIGNED";
  if (status === "SHIPPED") return "IN_PROGRESS";
  if (status === "DELIVERED") return "RESOLVED";
  return "CANCELLED";
}

function validateLines(raw: unknown, items: Array<{ id: string; sku: string; name: string; unit: string; active: boolean }>): MaterialSaleLine[] {
  if (!Array.isArray(raw) || raw.length > 50) throw new SaleError("Đơn hàng chỉ được có tối đa 50 dòng vật tư.");
  const byId = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  return raw.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new SaleError("Dòng vật tư không hợp lệ.");
    const row = value as Record<string, unknown>;
    const itemId = typeof row.itemId === "string" ? row.itemId : "";
    const item = byId.get(itemId);
    if (!item || !item.active) throw new SaleError("Vật tư không tồn tại hoặc đã ngừng bán.");
    if (seen.has(itemId)) throw new SaleError("Không được nhập trùng vật tư trong đơn.");
    seen.add(itemId);
    const quantity = Number(row.quantity);
    const unitPrice = Number(row.unitPrice);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) throw new SaleError("Số lượng phải là số nguyên từ 1 đến 10.000.");
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0 || unitPrice > 1000000000) throw new SaleError("Đơn giá không hợp lệ.");
    return { itemId, sku: item.sku, name: item.name, unit: item.unit, quantity, unitPrice };
  });
}

async function handleError(error: unknown) {
  if (error instanceof SaleError) return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
  console.error("Material sale failed", error);
  return NextResponse.json({ success: false, message: "Không lưu được đơn bán vật tư. Vui lòng thử lại." }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await hasRole(request, ["ADMIN", "SUPER_ADMIN", "CSKH"]);
    if (!auth) throw new SaleError("Chưa được cấp quyền.", 403);
    const { id } = await params;
    const ticket = await getSaleTicket(id, auth.user.role, auth.user.provinceScope);
    const [items, warehouses] = await Promise.all([
      prisma.inventoryItem.findMany({ where: { active: true }, select: { id: true, sku: true, name: true, unit: true, salePrice: true }, orderBy: { name: "asc" } }),
      prisma.warehouse.findMany({ where: { active: true }, select: { id: true, code: true, name: true, balances: { select: { itemId: true, quantity: true, reserved: true } } }, orderBy: { name: "asc" } }),
    ]);
    return NextResponse.json({ success: true, data: { ticketCode: ticket.ticketCode, order: readMaterialSale(ticket.description).order, items, warehouses } });
  } catch (error) { return handleError(error); }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await hasRole(request, ["ADMIN", "SUPER_ADMIN", "CSKH"]);
    if (!auth) throw new SaleError("Chưa được cấp quyền.", 403);
    const { id } = await params;
    const ticket = await getSaleTicket(id, auth.user.role, auth.user.provinceScope);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const nextStatus = typeof body.status === "string" ? body.status.toUpperCase() as MaterialSaleStatus : null;
    if (!nextStatus || !STATUSES.includes(nextStatus)) throw new SaleError("Trạng thái đơn hàng không hợp lệ.");
    const previous = readMaterialSale(ticket.description).order;
    const transitions: Record<MaterialSaleStatus, MaterialSaleStatus[]> = {
      DRAFT: ["DRAFT", "CONFIRMED", "CANCELLED"],
      CONFIRMED: ["CONFIRMED", "SHIPPED", "CANCELLED"],
      SHIPPED: ["DELIVERED"],
      DELIVERED: [],
      CANCELLED: [],
    };
    if (!transitions[previous.status].includes(nextStatus)) throw new SaleError("Không thể chuyển trạng thái đơn hàng theo hướng này.", 409);

    const editable = nextStatus === "DRAFT" || nextStatus === "CONFIRMED";
    const items = editable
      ? await prisma.inventoryItem.findMany({ where: { active: true }, select: { id: true, sku: true, name: true, unit: true, active: true } })
      : [];
    const lines = editable ? validateLines(body.lines, items) : previous.lines;
    if (nextStatus !== "DRAFT" && nextStatus !== "CANCELLED" && !lines.length) throw new SaleError("Cần chọn vật tư và số lượng trước khi xác nhận.");
    const total = materialSaleTotal(lines);
    if (!Number.isSafeInteger(total)) throw new SaleError("Tổng tiền vượt giới hạn cho phép.");
    const warehouseId = typeof body.warehouseId === "string" && body.warehouseId ? body.warehouseId : previous.warehouseId;
    const note = editable && typeof body.note === "string" ? body.note.trim().slice(0, 1000) : previous.note;
    if (nextStatus === "SHIPPED" && !warehouseId) throw new SaleError("Chọn kho xuất trước khi giao hàng.");
    if (warehouseId) {
      const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, active: true }, select: { id: true } });
      if (!warehouse) throw new SaleError("Kho xuất không tồn tại hoặc đã ngừng hoạt động.");
    }

    const order: MaterialSaleOrder = { status: nextStatus, lines, warehouseId: warehouseId || null, note, total, updatedAt: new Date().toISOString() };
    const movementCodes = nextStatus === "SHIPPED" ? await Promise.all(lines.map(() => createMovementCode())) : [];
    const updated = await prisma.$transaction(async (tx) => {
      const latest = await tx.supportTicket.findUnique({ where: { id }, select: { description: true, customerId: true, assigneeId: true, ticketCode: true } });
      if (!latest) throw new SaleError("Không tìm thấy đơn hàng.", 404);
      const latestOrder = readMaterialSale(latest.description).order;
      if (latestOrder.updatedAt !== previous.updatedAt || body.expectedUpdatedAt !== previous.updatedAt) {
        throw new SaleError("Đơn hàng đã được người khác cập nhật. Tải lại trước khi lưu.", 409);
      }
      if (nextStatus === "SHIPPED" && warehouseId) {
        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index];
          const balance = await tx.stockBalance.findUnique({ where: { warehouseId_itemId: { warehouseId, itemId: line.itemId } } });
          const available = (balance?.quantity || 0) - (balance?.reserved || 0);
          if (!balance || available < line.quantity) throw new SaleError(`Kho không đủ ${line.name}: còn ${Math.max(0, available)} ${line.unit}.`, 409);
          await tx.stockBalance.update({ where: { id: balance.id }, data: { quantity: { decrement: line.quantity } } });
          const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: line.itemId }, select: { costPrice: true } });
          await tx.stockMovement.create({ data: {
            movementCode: movementCodes[index], type: "OUT", itemId: line.itemId,
            fromWarehouseId: warehouseId, quantity: line.quantity, unitCost: item.costPrice,
            note: `Xuất bán vật tư ${latest.ticketCode} [material-sale:${id}]`,
            createdById: auth.user.id,
          } });
        }
      }
      const result = await tx.supportTicket.update({
        where: { id },
        data: { description: writeMaterialSale(latest.description, order), status: saleTicketStatus(nextStatus, Boolean(latest.assigneeId)), resolvedAt: nextStatus === "DELIVERED" ? new Date() : null },
      });
      if (latest.customerId && previous.status !== nextStatus) await tx.customerActivity.create({
        data: { customerId: latest.customerId, type: "MATERIAL_SALE", summary: `Đơn bán vật tư ${latest.ticketCode}: ${nextStatus}`, detail: `${lines.length} mặt hàng, tổng ${total.toLocaleString("vi-VN")} đ`, userId: auth.user.id },
      });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
    await writeAudit({ request, userId: auth.user.id, action: "UPDATE_MATERIAL_SALE", target: updated.ticketCode, detail: { status: nextStatus, total, lineCount: lines.length, warehouseId } });
    return NextResponse.json({ success: true, message: nextStatus === "SHIPPED" ? "Đã xuất kho và chuyển đơn sang đang giao." : nextStatus === "DELIVERED" ? "Đã xác nhận khách nhận đủ vật tư." : "Đã cập nhật đơn bán lõi/vật liệu.", data: order });
  } catch (error) { return handleError(error); }
}
