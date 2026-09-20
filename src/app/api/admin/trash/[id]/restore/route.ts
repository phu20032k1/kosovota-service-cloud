import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { ensureTrashStorage, RESTORABLE_TRASH_TYPES } from "@/lib/trash";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function arrayValue(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function stringArray(value: unknown): string[] {
  return arrayValue(value).map((item) => String(item || "")).filter(Boolean);
}

async function restoreTrashItem(request: NextRequest, id: string) {
  const auth = await hasRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được khôi phục dữ liệu." }, { status: 403 });

  await ensureTrashStorage(prisma);
  const item = await prisma.trashItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ success: false, message: "Không tìm thấy dữ liệu trong Thùng rác." }, { status: 404 });
  if (item.restoredAt) return NextResponse.json({ success: false, message: "Dữ liệu này đã được khôi phục trước đó." }, { status: 409 });
  if (!RESTORABLE_TRASH_TYPES.has(item.entityType)) {
    return NextResponse.json({ success: false, message: "Loại dữ liệu này hiện chỉ lưu bản sao, chưa hỗ trợ khôi phục tự động." }, { status: 400 });
  }

  const snapshot = objectValue(item.snapshot);
  try {
    await prisma.$transaction(async (tx) => {
      if (item.entityType === "USER") {
        await tx.user.create({ data: objectValue(snapshot.record) as unknown as Prisma.UserUncheckedCreateInput });
      } else if (item.entityType === "CUSTOMER") {
        const record = objectValue(snapshot.record);
        const customerId = String(record.id || item.entityId);
        await tx.customer.create({ data: record as unknown as Prisma.CustomerUncheckedCreateInput });
        const activities = arrayValue(snapshot.activities);
        if (activities.length) await tx.customerActivity.createMany({ data: activities as unknown as Prisma.CustomerActivityCreateManyInput[], skipDuplicates: true });
        const machineIds = stringArray(snapshot.machineIds);
        if (machineIds.length) await tx.machine.updateMany({ where: { id: { in: machineIds }, customerId: null }, data: { customerId } });
        const ticketIds = stringArray(snapshot.ticketIds);
        if (ticketIds.length) await tx.supportTicket.updateMany({ where: { id: { in: ticketIds }, customerId: null }, data: { customerId } });
      } else if (item.entityType === "DEALER") {
        const record = objectValue(snapshot.record);
        const dealerId = String(record.id || item.entityId);
        const dealerCode = String(record.dealerCode || "");
        await tx.dealer.create({ data: record as unknown as Prisma.DealerUncheckedCreateInput });

        const warehouseValue = objectValue(snapshot.warehouse);
        if (Object.keys(warehouseValue).length) {
          const balances = arrayValue(warehouseValue.balances);
          const warehouseRecord = { ...warehouseValue };
          delete warehouseRecord.balances;
          await tx.warehouse.create({ data: warehouseRecord as unknown as Prisma.WarehouseUncheckedCreateInput });
          if (balances.length) await tx.stockBalance.createMany({ data: balances as unknown as Prisma.StockBalanceCreateManyInput[], skipDuplicates: true });
        }

        for (const rawBatch of arrayValue(snapshot.paymentBatches)) {
          const batch = objectValue(rawBatch);
          const lines = arrayValue(batch.lines);
          const batchRecord = { ...batch };
          delete batchRecord.lines;
          await tx.paymentBatch.create({ data: batchRecord as unknown as Prisma.PaymentBatchUncheckedCreateInput });
          if (lines.length) await tx.paymentLine.createMany({ data: lines as unknown as Prisma.PaymentLineCreateManyInput[], skipDuplicates: true });
        }

        for (const rawUser of arrayValue(snapshot.linkedUsers)) {
          const user = objectValue(rawUser);
          const userId = String(user.id || "");
          if (!userId) continue;
          await tx.user.updateMany({
            where: { id: userId },
            data: {
              dealerCode: typeof user.dealerCode === "string" ? user.dealerCode : dealerCode || null,
              active: typeof user.active === "boolean" ? user.active : true,
            },
          });
        }

        const serviceOrderIds = stringArray(snapshot.serviceOrderIds);
        if (serviceOrderIds.length) await tx.serviceOrder.updateMany({ where: { id: { in: serviceOrderIds }, dealerId: null }, data: { dealerId } });
        const ticketIds = stringArray(snapshot.ticketIds);
        if (ticketIds.length) await tx.supportTicket.updateMany({ where: { id: { in: ticketIds }, dealerId: null }, data: { dealerId } });

        for (const rawMovement of arrayValue(snapshot.movementLinks)) {
          const movement = objectValue(rawMovement);
          const movementId = String(movement.id || "");
          if (!movementId) continue;
          await tx.stockMovement.updateMany({
            where: { id: movementId },
            data: {
              fromWarehouseId: typeof movement.fromWarehouseId === "string" ? movement.fromWarehouseId : null,
              toWarehouseId: typeof movement.toWarehouseId === "string" ? movement.toWarehouseId : null,
            },
          });
        }
      } else if (item.entityType === "SERVICE_ORDER") {
        const record = objectValue(snapshot.record);
        const orderId = String(record.id || item.entityId);
        await tx.serviceOrder.create({ data: record as unknown as Prisma.ServiceOrderUncheckedCreateInput });
        const reports = arrayValue(snapshot.reports);
        if (reports.length) await tx.serviceReport.createMany({ data: reports as unknown as Prisma.ServiceReportCreateManyInput[], skipDuplicates: true });
        const movementIds = stringArray(snapshot.stockMovementIds);
        if (movementIds.length) await tx.stockMovement.updateMany({ where: { id: { in: movementIds }, serviceOrderId: null }, data: { serviceOrderId: orderId } });
        const sourceTicketId = typeof snapshot.sourceTicketId === "string" ? snapshot.sourceTicketId : "";
        if (sourceTicketId) await tx.supportTicket.updateMany({ where: { id: sourceTicketId, serviceOrderId: null }, data: { serviceOrderId: orderId } });
      } else if (item.entityType === "SUPPORT_TICKET") {
        const originalRecord = objectValue(snapshot.record);
        const ticketId = String(originalRecord.id || item.entityId);
        await tx.supportTicket.create({ data: { ...originalRecord, serviceOrderId: null } as unknown as Prisma.SupportTicketUncheckedCreateInput });

        const linked = objectValue(snapshot.linkedServiceOrder);
        if (Object.keys(linked).length) {
          const orderRecord = objectValue(linked.record);
          const orderId = String(orderRecord.id || "");
          if (orderId) {
            await tx.serviceOrder.create({ data: orderRecord as unknown as Prisma.ServiceOrderUncheckedCreateInput });
            const reports = arrayValue(linked.reports);
            if (reports.length) await tx.serviceReport.createMany({ data: reports as unknown as Prisma.ServiceReportCreateManyInput[], skipDuplicates: true });
            const movementIds = stringArray(linked.stockMovementIds);
            if (movementIds.length) await tx.stockMovement.updateMany({ where: { id: { in: movementIds }, serviceOrderId: null }, data: { serviceOrderId: orderId } });
            await tx.supportTicket.update({ where: { id: ticketId }, data: { serviceOrderId: orderId } });
          }
        }

        const messages = arrayValue(snapshot.messages);
        if (messages.length) await tx.ticketMessage.createMany({ data: messages as unknown as Prisma.TicketMessageCreateManyInput[], skipDuplicates: true });
      } else if (item.entityType === "MAINTENANCE_SCHEDULE") {
        await tx.maintenanceSchedule.create({ data: objectValue(snapshot.record) as unknown as Prisma.MaintenanceScheduleUncheckedCreateInput });
      }

      await tx.trashItem.update({ where: { id: item.id }, data: { restoredAt: new Date(), restoredById: auth.user.id } });
    });

    await writeAudit({ request, userId: auth.user.id, action: "RESTORE_FROM_TRASH", target: item.entityType + ":" + item.entityId, detail: { trashId: item.id, label: item.label } });
    return NextResponse.json({ success: true, message: "Đã khôi phục dữ liệu từ Thùng rác." });
  } catch (error) {
    console.error("POST /api/admin/trash/[id]/restore failed", error);
    const message = error instanceof Error ? error.message : "Không khôi phục được dữ liệu.";
    return NextResponse.json({ success: false, message: "Không khôi phục được vì dữ liệu liên quan đã thay đổi hoặc bị trùng. Chi tiết: " + message }, { status: 409 });
  }
}


export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return restoreTrashItem(request, id);
}
