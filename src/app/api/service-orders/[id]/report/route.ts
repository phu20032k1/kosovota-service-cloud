import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { createMovementCode } from "@/lib/enterprise-codes";
import { writeAudit } from "@/lib/audit";
import { queueServiceCompletedEmail } from "@/lib/notifications/events";

type Params = { params: Promise<{ id: string }> };
type MaterialInput = { itemId: string; quantity: number };
type InventoryItemRecord = { id: string; name: string; unit: string; costPrice: number };

function parseMaterials(value: unknown): MaterialInput[] {
  if (!Array.isArray(value)) return [];
  const quantities = new Map<string, number>();
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const itemId = typeof (row as Record<string, unknown>).itemId === "string"
      ? String((row as Record<string, unknown>).itemId).trim()
      : "";
    const quantity = Math.round(Number((row as Record<string, unknown>).quantity));
    if (!itemId || !Number.isFinite(quantity) || quantity <= 0) continue;
    quantities.set(itemId, (quantities.get(itemId) || 0) + quantity);
  }
  return [...quantities].map(([itemId, quantity]) => ({ itemId, quantity }));
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN", "DEALER", "CTV", "KTV"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const materials = parseMaterials(body.materials);
    const order = await prisma.serviceOrder.findUnique({
      where: { id },
      include: { dealer: true, machine: { include: { customer: true } }, reports: { select: { id: true }, take: 1 } },
    });
    if (!order) return NextResponse.json({ success: false, message: "Không tìm thấy lệnh dịch vụ." }, { status: 404 });
    if (["DEALER", "CTV"].includes(auth.user.role) && order.dealer?.dealerCode !== auth.user.dealerCode) {
      return NextResponse.json({ success: false, message: "Lệnh không thuộc đại lý này." }, { status: 403 });
    }
    if (auth.user.role === "KTV" && order.technicianId !== auth.user.id) {
      return NextResponse.json({ success: false, message: "Lệnh chưa được giao cho KTV này." }, { status: 403 });
    }
    if (order.status === "COMPLETED" || order.reports.length) {
      return NextResponse.json({ success: false, message: "Lệnh này đã có báo cáo hoàn thành." }, { status: 409 });
    }
    if (!["ACCEPTED", "IN_PROGRESS"].includes(order.status)) {
      return NextResponse.json({ success: false, message: "Cần nhận và bắt đầu lệnh trước khi báo cáo." }, { status: 400 });
    }

    const oldCorePhoto = typeof body.oldCorePhoto === "string" ? body.oldCorePhoto.trim() : "";
    const newCorePhoto = typeof body.newCorePhoto === "string" ? body.newCorePhoto.trim() : "";
    const signature = typeof body.signature === "string" ? body.signature.trim() : "";
    if (!oldCorePhoto || !newCorePhoto || !signature) {
      return NextResponse.json({ success: false, message: "Cần ảnh lõi cũ, ảnh lõi mới và chữ ký khách hàng." }, { status: 400 });
    }
    if (materials.length && !order.dealerId) {
      return NextResponse.json({ success: false, message: "Lệnh chưa được gắn đại lý nên chưa thể xuất vật tư." }, { status: 400 });
    }

    const movementCodes: string[] = [];
    for (let index = 0; index < materials.length; index += 1) movementCodes.push(await createMovementCode());

    const result = await prisma.$transaction(async (tx) => {
      let materialSummary = "";
      const createdMovements: { movementCode: string; itemName: string; quantity: number; unitCost: number }[] = [];

      if (materials.length) {
        const warehouse = await tx.warehouse.findUnique({ where: { dealerId: order.dealerId! } });
        if (!warehouse) throw new Error("Đại lý chưa có kho vật tư. Vui lòng liên hệ Admin tạo kho trước.");

        const items = await tx.inventoryItem.findMany({
          where: { id: { in: materials.map((row) => row.itemId) }, active: true },
        });
        if (items.length !== materials.length) throw new Error("Có vật tư không tồn tại hoặc đã ngừng sử dụng.");
        const itemMap = new Map((items as InventoryItemRecord[]).map((item) => [item.id, item]));

        for (let index = 0; index < materials.length; index += 1) {
          const material = materials[index];
          const item = itemMap.get(material.itemId)!;
          const balance = await tx.stockBalance.findUnique({
            where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: item.id } },
          });
          if (!balance || balance.quantity - balance.reserved < material.quantity) {
            throw new Error(`Tồn khả dụng của “${item.name}” không đủ. Hiện còn ${Math.max(0, (balance?.quantity || 0) - (balance?.reserved || 0))} ${item.unit}.`);
          }
          await tx.stockBalance.update({
            where: { id: balance.id },
            data: { quantity: { decrement: material.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              movementCode: movementCodes[index],
              type: "SERVICE_USE",
              itemId: item.id,
              fromWarehouseId: warehouse.id,
              serviceOrderId: order.id,
              quantity: material.quantity,
              unitCost: item.costPrice,
              note: `Xuất tự động khi hoàn thành lệnh ${order.orderCode}`,
              createdById: auth.user.id,
            },
          });
          createdMovements.push({ movementCode: movementCodes[index], itemName: item.name, quantity: material.quantity, unitCost: item.costPrice });
        }
        materialSummary = materials.map((row) => {
          const item = itemMap.get(row.itemId)!;
          return `${item.name} (${row.quantity} ${item.unit})`;
        }).join(", ");
      }

      const products = typeof body.products === "string" && body.products.trim()
        ? body.products.trim()
        : materialSummary || null;
      const report = await tx.serviceReport.create({
        data: {
          orderId: order.id,
          machineId: order.machineId,
          dealerCode: order.dealer?.dealerCode || auth.user.dealerCode || null,
          serviceType: typeof body.serviceType === "string" ? body.serviceType : order.serviceType,
          products,
          oldCorePhoto,
          newCorePhoto,
          finalPhoto: typeof body.finalPhoto === "string" ? body.finalPhoto || null : null,
          signature,
          note: typeof body.note === "string" ? body.note || null : null,
        },
      });
      await tx.serviceOrder.update({ where: { id }, data: { status: "COMPLETED" } });
      if (order.maintenanceScheduleId) {
        await tx.maintenanceSchedule.update({ where: { id: order.maintenanceScheduleId }, data: { status: "COMPLETED" } });
      }
      return { report, movements: createdMovements };
    });

    await writeAudit({
      request,
      userId: auth.user.id,
      action: "COMPLETE_SERVICE_ORDER",
      target: order.orderCode,
      detail: { reportId: result.report.id, materials: result.movements },
    });
    if (order.machine.customer) {
      await queueServiceCompletedEmail({
        customer: order.machine.customer,
        orderCode: order.orderCode,
        machineId: order.machineId,
        serviceType: order.serviceType,
        products: result.report.products,
      });
    }
    return NextResponse.json({
      success: true,
      message: materials.length
        ? `Đã hoàn thành lệnh và xuất ${materials.length} loại vật tư khỏi kho.`
        : "Đã gửi báo cáo và hoàn thành lệnh.",
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không gửi được báo cáo dịch vụ.";
    console.error("POST report failed", error);
    const isBusinessError = /không đủ|chưa có kho|không tồn tại|ngừng sử dụng/i.test(message);
    return NextResponse.json({ success: false, message }, { status: isBusinessError ? 400 : 500 });
  }
}
