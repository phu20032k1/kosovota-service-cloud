import { archiveToTrash } from "@/lib/trash";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { queueServiceStatusEmail } from "@/lib/notifications/events";
import { databaseErrorMessage } from "@/lib/database-errors";
import { protectServiceOrderCustomerData } from "@/lib/service-order-privacy";
import { createTicketCode } from "@/lib/enterprise-codes";

type Params = { params: Promise<{ id: string }> };
const ALLOWED_STATUSES = ["NEW", "CALLED_NO_ANSWER", "CUSTOMER_ACCEPTED", "CUSTOMER_SELF_SERVICE", "CUSTOMER_INTERNAL", "CUSTOMER_REJECTED", "RESCHEDULED", "COMPLAINT", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const ACTIVE_SERVICE_STATUSES = ["NEW", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "CALLED_NO_ANSWER", "CUSTOMER_ACCEPTED", "RESCHEDULED", "COMPLAINT"];

async function getAuthorizedOrder(request: NextRequest, id: string) {
  const auth = await hasRole(request, ["ADMIN", "SUPER_ADMIN", "CSKH", "DEALER", "CTV", "KTV"]);
  if (!auth) return { auth: null, order: null };
  const order = await prisma.serviceOrder.findUnique({ where: { id }, include: { machine: { include: { customer: true, activations: true, maintenanceSchedules: true } }, dealer: true, technician: true, reports: true, maintenanceSchedule: true, sourceTicket: { include: { messages: { orderBy: { createdAt: "asc" } } } } } });
  if (!order) return { auth, order: null };
  if (["DEALER", "CTV"].includes(auth.user.role) && order.dealer?.dealerCode !== auth.user.dealerCode) return { auth: null, order: null };
  if (auth.user.role === "KTV" && order.technicianId !== auth.user.id) return { auth: null, order: null };
  return { auth, order };
}

async function ensureCareWorkflowTicket(input: {
  orderId: string;
  orderCode: string;
  machineId: string;
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  assigneeId?: string | null;
  kind: "MATERIAL_SALE" | "INTERNAL_CARE";
}) {
  const marker = `[order:${input.orderId}]`;
  const existing = await prisma.supportTicket.findFirst({
    where: {
      machineId: input.machineId,
      type: input.kind,
      status: { notIn: ["RESOLVED", "CLOSED"] },
      description: { contains: marker },
    },
    select: { id: true, ticketCode: true },
  });
  if (existing) return { ticketCode: existing.ticketCode, created: false };

  const ticketCode = await createTicketCode();
  const materialSale = input.kind === "MATERIAL_SALE";
  const subject = materialSale
    ? `Bán lõi/vật liệu tự thay - ${input.machineId}`
    : `Nhắc nhân viên chăm sóc máy nội bộ - ${input.machineId}`;
  const description = materialSale
    ? `Tự động tạo từ lệnh ${input.orderCode}. Khách hàng chọn tự thay; CSKH cần tư vấn, chốt lõi/vật liệu phù hợp và theo dõi giao hàng. ${marker}`
    : `Tự động tạo từ lệnh ${input.orderCode}. Đây là khách hàng/máy nội bộ công ty; cần giao nhân viên phụ trách chăm sóc và xác nhận hoàn tất. ${marker}`;

  await prisma.$transaction(async (tx) => {
    await tx.supportTicket.create({
      data: {
        ticketCode,
        type: input.kind,
        source: "CSKH_WORKFLOW",
        subject,
        description,
        status: "NEW",
        priority: "NORMAL",
        customerId: input.customerId || null,
        machineId: input.machineId,
        assigneeId: input.assigneeId || null,
        contactName: input.customerName,
        contactPhone: input.customerPhone,
        dueAt: new Date(),
      },
    });
    if (input.customerId) {
      await tx.customerActivity.create({
        data: {
          customerId: input.customerId,
          type: materialSale ? "SELF_SERVICE_SALE" : "INTERNAL_CARE",
          summary: materialSale ? `Khách tự thay - tạo yêu cầu bán lõi ${ticketCode}` : `Máy nội bộ - tạo nhắc nhân viên ${ticketCode}`,
          detail: description,
          userId: input.assigneeId || null,
        },
      });
    }
  });
  return { ticketCode, created: true };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const result = await getAuthorizedOrder(request, id);
    if (!result.auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
    if (!result.order) return NextResponse.json({ success: false, message: "Không tìm thấy lệnh dịch vụ." }, { status: 404 });
    const data = protectServiceOrderCustomerData(result.order, result.auth.user.role);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/service-orders/[id] failed", error);
    return NextResponse.json({ success: false, message: databaseErrorMessage(error, "Không tải được chi tiết lệnh dịch vụ.") }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { auth, order: current } = await getAuthorizedOrder(request, id);
    if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
    if (!current) return NextResponse.json({ success: false, message: "Không tìm thấy lệnh dịch vụ." }, { status: 404 });
    const body = await request.json();
    const status = typeof body.status === "string" ? body.status.toUpperCase() : undefined;
    if (status && !ALLOWED_STATUSES.includes(status)) return NextResponse.json({ success: false, message: "Trạng thái không hợp lệ." }, { status: 400 });
    if (["DEALER", "CTV"].includes(auth.user.role)) {
      const allowedDealerStatuses = ["ACCEPTED", "IN_PROGRESS", "NEW"];
      if (status && !allowedDealerStatuses.includes(status)) return NextResponse.json({ success: false, message: "Đại lý không được phép đặt trạng thái này." }, { status: 403 });
      if (body.dealerId && body.dealerId !== current.dealerId) return NextResponse.json({ success: false, message: "Không được chuyển lệnh sang đại lý khác." }, { status: 403 });
    }
    if (auth.user.role === "KTV") {
      if (status && !["ACCEPTED", "IN_PROGRESS"].includes(status)) return NextResponse.json({ success: false, message: "KTV chỉ được nhận lệnh hoặc bắt đầu xử lý." }, { status: 403 });
      if ("dealerId" in body || "technicianId" in body) return NextResponse.json({ success: false, message: "KTV không được thay đổi phân công." }, { status: 403 });
    }

    const rejected = ["DEALER", "CTV"].includes(auth.user.role) && status === "NEW" && body.dealerId === null;
    const dueDate = status === "CALLED_NO_ANSWER"
      ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      : body.dueDate === null || body.dueDate === ""
        ? null
        : body.dueDate
          ? new Date(body.dueDate)
          : undefined;
    const serviceFee = body.serviceFee === null || body.serviceFee === "" ? null : Number.isFinite(Number(body.serviceFee)) ? Number(body.serviceFee) : undefined;

    const order = await prisma.serviceOrder.update({
      where: { id },
      data: {
        status,
        dealerId: body.dealerId === null ? null : typeof body.dealerId === "string" ? body.dealerId : undefined,
        rejectReason: rejected || typeof body.rejectReason === "string" ? String(body.rejectReason || "Đại lý từ chối") : undefined,
        rejectedAt: rejected || typeof body.rejectReason === "string" ? new Date() : undefined,
        serviceType: typeof body.serviceType === "string" ? body.serviceType.trim() : undefined,
        dueDate,
        serviceFee,
        paymentStatus: typeof body.paymentStatus === "string" && ["ADMIN", "SUPER_ADMIN"].includes(auth.user.role) ? body.paymentStatus : undefined,
      },
      include: { machine: { include: { customer: true, activations: true, maintenanceSchedules: true } }, dealer: true, technician: true, reports: true, maintenanceSchedule: true, sourceTicket: { include: { messages: { orderBy: { createdAt: "asc" } } } } },
    });

    const workflow: { ticketCode?: string; disabledSchedules?: number; cancelledOrders?: number } = {};

    if (status === "CUSTOMER_REJECTED") {
      const openSchedules = await prisma.maintenanceSchedule.findMany({
        where: { machineId: current.machineId, status: { in: ["PENDING", "ORDER_CREATED"] } },
        select: { id: true },
      });
      const scheduleIds = openSchedules.map((item) => item.id);
      const [disabled, cancelled] = await prisma.$transaction([
        prisma.maintenanceSchedule.updateMany({ where: { id: { in: scheduleIds } }, data: { status: "DISABLED" } }),
        prisma.serviceOrder.updateMany({
          where: { id: { not: current.id }, maintenanceScheduleId: { in: scheduleIds }, status: { in: ACTIVE_SERVICE_STATUSES } },
          data: { status: "CANCELLED" },
        }),
      ]);
      workflow.disabledSchedules = disabled.count;
      workflow.cancelledOrders = cancelled.count;
      if (order.machine.customer?.id) {
        await prisma.customerActivity.create({
          data: {
            customerId: order.machine.customer.id,
            type: "CARE_REJECTED",
            summary: `Khách từ chối chăm sóc máy ${order.machineId}`,
            detail: `Đã tắt ${disabled.count} lịch nhắc còn mở để hệ thống không tự nhắc lại.`,
            userId: auth.user.id,
          },
        });
      }
    }

    if (status === "CUSTOMER_SELF_SERVICE") {
      if (current.maintenanceScheduleId) await prisma.maintenanceSchedule.update({ where: { id: current.maintenanceScheduleId }, data: { status: "SELF_SERVICE" } });
      const ticket = await ensureCareWorkflowTicket({
        orderId: current.id,
        orderCode: current.orderCode,
        machineId: current.machineId,
        customerId: current.machine.customer?.id,
        customerName: current.machine.customer?.name || current.customerName,
        customerPhone: current.machine.customer?.phone || current.customerPhone,
        assigneeId: auth.user.role === "CSKH" ? auth.user.id : null,
        kind: "MATERIAL_SALE",
      });
      workflow.ticketCode = ticket.ticketCode;
    }

    if (status === "CUSTOMER_INTERNAL") {
      if (current.maintenanceScheduleId) await prisma.maintenanceSchedule.update({ where: { id: current.maintenanceScheduleId }, data: { status: "INTERNAL" } });
      const ticket = await ensureCareWorkflowTicket({
        orderId: current.id,
        orderCode: current.orderCode,
        machineId: current.machineId,
        customerId: current.machine.customer?.id,
        customerName: current.machine.customer?.name || current.customerName,
        customerPhone: current.machine.customer?.phone || current.customerPhone,
        assigneeId: auth.user.role === "CSKH" ? auth.user.id : null,
        kind: "INTERNAL_CARE",
      });
      workflow.ticketCode = ticket.ticketCode;
    }

    if (status && status !== current.status && order.machine.customer && status !== "CUSTOMER_INTERNAL") {
      await queueServiceStatusEmail({ customer: order.machine.customer, orderCode: order.orderCode, machineId: order.machineId, status, serviceType: order.serviceType });
    }

    let message = "Đã cập nhật lệnh dịch vụ.";
    if (status === "CALLED_NO_ANSWER") message = "Đã hẹn hệ thống nhắc lại sau 3 ngày.";
    if (status === "CUSTOMER_SELF_SERVICE") message = `Đã chuyển sang khách tự thay và tạo yêu cầu bán lõi/vật liệu ${workflow.ticketCode || ""}.`.trim();
    if (status === "CUSTOMER_INTERNAL") message = `Đã chuyển sang chăm sóc nội bộ và tạo nhắc nhân viên ${workflow.ticketCode || ""}.`.trim();
    if (status === "CUSTOMER_REJECTED") message = `Đã tắt ${workflow.disabledSchedules || 0} lịch nhắc còn mở${workflow.cancelledOrders ? ` và hủy ${workflow.cancelledOrders} lệnh tự động liên quan` : ""}.`;

    return NextResponse.json({ success: true, message, data: protectServiceOrderCustomerData(order, auth.user.role), workflow });
  } catch (error) {
    console.error("PUT /api/service-orders/[id] failed", error);
    return NextResponse.json({ success: false, message: databaseErrorMessage(error, "Không cập nhật được lệnh dịch vụ.") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN", "SUPER_ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin/CSKH được xóa lệnh." }, { status: 403 });
  try {
    const { id } = await params;
    const order = await prisma.serviceOrder.findUnique({
      where: { id },
      include: { machine: true, sourceTicket: true, reports: true, stockMovements: { select: { id: true } } },
    });
    if (!order) return NextResponse.json({ success: false, message: "Không tìm thấy lệnh dịch vụ." }, { status: 404 });
    if (auth.user.role === "CSKH" && auth.user.provinceScope) {
      const scopes = auth.user.provinceScope.split(",").map((value: string) => value.trim()).filter(Boolean);
      if (scopes.length && (!order.machine.provinceCode || !scopes.includes(order.machine.provinceCode))) return NextResponse.json({ success: false, message: "Lệnh nằm ngoài phạm vi CSKH được phân công." }, { status: 403 });
    }
    await prisma.$transaction(async (tx) => {
      const { machine, sourceTicket, reports, stockMovements, ...record } = order;
      await archiveToTrash(tx, {
        entityType: "SERVICE_ORDER",
        entityId: order.id,
        label: order.orderCode + " · " + order.customerName,
        snapshot: { record, reports, stockMovementIds: stockMovements.map((item) => item.id), sourceTicketId: sourceTicket?.id || null },
        deletedById: auth.user.id,
        deletedByName: auth.user.name,
        source: "/api/service-orders/[id]",
      });
      if (order.sourceTicket) await tx.supportTicket.update({ where: { id: order.sourceTicket.id }, data: { serviceOrderId: null, status: order.sourceTicket.status === "RESOLVED" ? "RESOLVED" : "NEW" } });
      await tx.serviceReport.deleteMany({ where: { orderId: id } });
      await tx.stockMovement.updateMany({ where: { serviceOrderId: id }, data: { serviceOrderId: null } });
      await tx.serviceOrder.delete({ where: { id } });
    });
    return NextResponse.json({ success: true, message: order.sourceTicket ? `Đã chuyển lệnh ${order.orderCode} vào Thùng rác. Yêu cầu ${order.sourceTicket.ticketCode} vẫn được giữ lại.` : `Đã chuyển lệnh ${order.orderCode} vào Thùng rác.` });
  } catch (error) {
    console.error("DELETE /api/service-orders/[id] failed", error);
    return NextResponse.json({ success: false, message: databaseErrorMessage(error, "Không xóa được lệnh dịch vụ.") }, { status: 500 });
  }
}
