import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
  throw new Error("Kho đang có giao dịch đồng thời. Vui lòng thử lại.");
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
      include: {
        dealer: true,
        machine: { include: { customer: true } },
        reports: { select: { id: true }, take: 1 },
      },
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
    for (let index = 0; index < materials.length; index += 1) {
      movementCodes.push(await createMovementCode());
    }

    const result = await serializableTransaction(async (tx) => {
      const currentOrder = await tx.serviceOrder.findUnique({
        where: { id },
        select: {
          status: true,
          reports: { select: { id: true }, take: 1 },
        },
      });
      if (!currentOrder) throw new Error("Không tìm thấy lệnh dịch vụ.");
      if (currentOrder.status === "COMPLETED" || currentOrder.reports.length) {
        throw new Error("Lệnh này đã có báo cáo hoàn thành.");
      }
      if (!["ACCEPTED", "IN_PROGRESS"].includes(currentOrder.status)) {
        throw new Error("Cần nhận và bắt đầu lệnh trước khi báo cáo.");
      }

      let materialSummary = "";
      const createdMovements: { movementCode: string; itemName: string; quantity: number; unitCost: number }[] = [];

      if (materials.length) {
        const warehouse = await tx.warehouse.findUnique({ where: { dealerId: order.dealerId! } });
        if (!warehouse || !warehouse.active) {
          throw new Error("Đại lý chưa có kho vật tư đang hoạt động. Vui lòng liên hệ Admin tạo hoặc mở kho trước.");
        }

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
          const available = Math.max(0, (balance?.quantity || 0) - (balance?.reserved || 0));
          if (!balance || available < material.quantity) {
            throw new Error(`Tồn khả dụng của “${item.name}” không đủ. Hiện còn ${available} ${item.unit}.`);
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
          createdMovements.push({
            movementCode: movementCodes[index],
            itemName: item.name,
            quantity: material.quantity,
            unitCost: item.costPrice,
          });
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
        await tx.maintenanceSchedule.update({
          where: { id: order.maintenanceScheduleId },
          data: { status: "COMPLETED" },
        });
      }

      const linkedTicket = await tx.supportTicket.findUnique({ where: { serviceOrderId: order.id } });
      if (linkedTicket) {
        const resolvedAt = new Date();
        await tx.supportTicket.update({
          where: { id: linkedTicket.id },
          data: { status: "RESOLVED", resolvedAt },
        });
        await tx.ticketMessage.create({
          data: {
            ticketId: linkedTicket.id,
            authorId: auth.user.id,
            authorName: auth.user.name,
            message: `Đã sửa xong. Báo cáo hoàn thành lệnh ${order.orderCode} đã được ghi nhận.`,
            isInternal: false,
          },
        });
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
        ? `Đã hoàn thành lệnh, cập nhật yêu cầu thành “Đã sửa” và xuất ${materials.length} loại vật tư khỏi kho.`
        : "Đã gửi báo cáo, hoàn thành lệnh và cập nhật yêu cầu thành “Đã sửa”.",
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không gửi được báo cáo dịch vụ.";
    console.error("POST report failed", error);
    const isConflict = /đã có báo cáo|giao dịch đồng thời/i.test(message);
    const isBusinessError = /không đủ|chưa có kho|không tồn tại|ngừng sử dụng|cần nhận|đang hoạt động/i.test(message);
    return NextResponse.json(
      { success: false, message },
      { status: isConflict ? 409 : isBusinessError ? 400 : 500 },
    );
  }
}
