import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { createOrderCode } from "@/lib/order-code";
import { databaseErrorMessage } from "@/lib/database-errors";

const DEALER_OPERATOR_ROLES = new Set(["DEALER", "CTV"]);
type Params = { params: Promise<{ id: string }> };

function orderStatusFromTicket(status: string, hasDealer: boolean) {
  if (status === "ASSIGNED") return "ASSIGNED";
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "RESOLVED" || status === "CLOSED") return "COMPLETED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "NEW") return hasDealer ? "ASSIGNED" : "NEW";
  return undefined;
}

function serviceTypeFromTicket(type: string, subject: string) {
  const prefix: Record<string, string> = {
    WARRANTY: "Bảo hành",
    REPAIR: "Sửa chữa",
    MAINTENANCE: "Bảo trì",
    INSTALLATION: "Lắp đặt",
    COMPLAINT: "Kiểm tra khiếu nại",
  };
  return `${prefix[type] || "Dịch vụ"}: ${subject}`.slice(0, 240);
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await hasRole(request, ["ADMIN", "CSKH", "DEALER", "CTV"]);
    if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
    const { id } = await params;
    const body = await request.json();
    const current = await prisma.supportTicket.findUnique({
      where: { id },
      include: { dealer: true, machine: { include: { customer: true } }, serviceOrder: true },
    });
    if (!current) return NextResponse.json({ success: false, message: "Không tìm thấy yêu cầu." }, { status: 404 });
    const dealerOperator = DEALER_OPERATOR_ROLES.has(auth.user.role);
    if (dealerOperator && current.dealer?.dealerCode !== auth.user.dealerCode) {
      return NextResponse.json({ success: false, message: "Yêu cầu không thuộc đại lý/CTV." }, { status: 403 });
    }

    const status = typeof body.status === "string" ? body.status.toUpperCase() : undefined;
    const allowed = ["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED", "CANCELLED"];
    if (status && !allowed.includes(status)) return NextResponse.json({ success: false, message: "Trạng thái không hợp lệ." }, { status: 400 });

    const requestedDealerId = !dealerOperator && "dealerId" in body ? (body.dealerId || null) : undefined;
    const nextDealerId = requestedDealerId === undefined ? current.dealerId : requestedDealerId;
    const ensureServiceOrder = Boolean(body.ensureServiceOrder) && !current.serviceOrderId;
    if (ensureServiceOrder && !current.machine) {
      return NextResponse.json({ success: false, message: "Ticket chưa gắn máy nên chưa thể tạo lệnh Điều phối." }, { status: 400 });
    }
    const orderCode = ensureServiceOrder && current.machine ? await createOrderCode(current.machine.provinceCode || "01") : null;

    const updateData: Record<string, unknown> = {
      ...(status ? { status, resolvedAt: ["RESOLVED", "CLOSED"].includes(status) ? new Date() : null } : {}),
      ...(!dealerOperator && typeof body.priority === "string" ? { priority: body.priority } : {}),
      ...(!dealerOperator && "assigneeId" in body ? { assigneeId: body.assigneeId || null } : {}),
      ...(requestedDealerId !== undefined ? { dealerId: requestedDealerId } : {}),
      ...(body.dueAt ? { dueAt: new Date(body.dueAt) } : {}),
      ...(Number.isInteger(body.satisfaction) ? { satisfaction: Math.min(5, Math.max(1, body.satisfaction)) } : {}),
    };

    const updated = await prisma.$transaction(async (tx) => {
      let linkedOrderId = current.serviceOrderId;
      if (ensureServiceOrder && current.machine && orderCode) {
        const order = await tx.serviceOrder.create({
          data: {
            orderCode,
            machineId: current.machine.id,
            dealerId: nextDealerId || null,
            customerName: current.machine.customer?.name || current.contactName,
            customerPhone: current.machine.customer?.phone || current.contactPhone,
            address: current.machine.customer?.address || null,
            serviceType: serviceTypeFromTicket(current.type, current.subject),
            status: nextDealerId ? "ASSIGNED" : "NEW",
            dueDate: current.dueAt,
          },
        });
        linkedOrderId = order.id;
        updateData.serviceOrderId = order.id;
      }

      const ticket = await tx.supportTicket.update({ where: { id }, data: updateData });
      if (linkedOrderId) {
        const mappedStatus = status ? orderStatusFromTicket(status, Boolean(nextDealerId)) : undefined;
        await tx.serviceOrder.update({
          where: { id: linkedOrderId },
          data: {
            ...(requestedDealerId !== undefined ? { dealerId: requestedDealerId } : {}),
            ...(mappedStatus ? { status: mappedStatus } : {}),
            ...(body.dueAt ? { dueDate: new Date(body.dueAt) } : {}),
          },
        });
      }
      if (typeof body.message === "string" && body.message.trim()) {
        await tx.ticketMessage.create({
          data: {
            ticketId: id,
            authorId: auth.user.id,
            authorName: auth.user.name,
            message: body.message.trim(),
            attachment: typeof body.attachment === "string" ? body.attachment || null : null,
            isInternal: Boolean(body.isInternal) && !dealerOperator,
          },
        });
      }
      if (ticket.customerId && (status || ensureServiceOrder || (typeof body.message === "string" && body.message.trim()))) {
        await tx.customerActivity.create({
          data: {
            customerId: ticket.customerId,
            type: ensureServiceOrder ? "DISPATCH_CREATED" : status ? "TICKET_STATUS" : "TICKET_MESSAGE",
            summary: ensureServiceOrder
              ? `${ticket.ticketCode} đã chuyển sang Điều phối`
              : status ? `${ticket.ticketCode} chuyển trạng thái ${status}` : `Trao đổi tại ${ticket.ticketCode}`,
            detail: typeof body.message === "string" ? body.message.trim() || null : null,
            userId: auth.user.id,
          },
        });
      }
      return tx.supportTicket.findUnique({
        where: { id },
        include: {
          customer: true,
          machine: true,
          dealer: true,
          assignee: true,
          serviceOrder: { include: { dealer: true, technician: true, reports: true } },
          messages: { orderBy: { createdAt: "asc" } },
        },
      });
    });
    await writeAudit({
      request,
      userId: auth.user.id,
      action: "UPDATE_SUPPORT_TICKET",
      target: current.ticketCode,
      detail: { status, assigneeId: body.assigneeId, dealerId: body.dealerId, ensuredDispatch: ensureServiceOrder },
    });
    return NextResponse.json({
      success: true,
      message: ensureServiceOrder ? "Đã tạo và liên kết lệnh Điều phối." : "Đã cập nhật yêu cầu và đồng bộ lệnh Điều phối.",
      data: updated,
    });
  } catch (error) {
    console.error("PUT /api/support-tickets/[id] failed", error);
    return NextResponse.json(
      { success: false, message: databaseErrorMessage(error, "Không cập nhật được yêu cầu hỗ trợ.") },
      { status: 500 },
    );
  }
}
