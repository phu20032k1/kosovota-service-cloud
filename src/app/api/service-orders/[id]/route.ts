import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { queueServiceStatusEmail } from "@/lib/notifications/events";
import { databaseErrorMessage } from "@/lib/database-errors";

type Params = { params: Promise<{ id: string }> };
const ALLOWED_STATUSES = [
  "NEW", "CALLED_NO_ANSWER", "CUSTOMER_ACCEPTED", "CUSTOMER_SELF_SERVICE",
  "CUSTOMER_REJECTED", "RESCHEDULED", "COMPLAINT", "ASSIGNED", "ACCEPTED",
  "IN_PROGRESS", "COMPLETED", "CANCELLED",
];

async function getAuthorizedOrder(request: NextRequest, id: string) {
  const auth = await hasRole(request, ["ADMIN", "CSKH", "DEALER", "CTV", "KTV"]);
  if (!auth) return { auth: null, order: null };
  const order = await prisma.serviceOrder.findUnique({
    where: { id },
    include: { machine: { include: { customer: true, activations: true, maintenanceSchedules: true } }, dealer: true, technician: true, reports: true, maintenanceSchedule: true, sourceTicket: { include: { messages: { orderBy: { createdAt: "asc" } } } } },
  });
  if (!order) return { auth, order: null };
  if (["DEALER", "CTV"].includes(auth.user.role) && order.dealer?.dealerCode !== auth.user.dealerCode) return { auth: null, order: null };
  if (auth.user.role === "KTV" && order.technicianId !== auth.user.id) return { auth: null, order: null };
  return { auth, order };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const result = await getAuthorizedOrder(request, id);
    if (!result.auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
    if (!result.order) return NextResponse.json({ success: false, message: "Không tìm thấy lệnh dịch vụ." }, { status: 404 });
    return NextResponse.json({ success: true, data: result.order });
  } catch (error) {
    console.error("GET /api/service-orders/[id] failed", error);
    return NextResponse.json(
      { success: false, message: databaseErrorMessage(error, "Không tải được chi tiết lệnh dịch vụ.") },
      { status: 500 },
    );
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
    if (status && !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, message: "Trạng thái không hợp lệ." }, { status: 400 });
    }

    if (["DEALER", "CTV"].includes(auth.user.role)) {
      const allowedDealerStatuses = ["ACCEPTED", "IN_PROGRESS", "NEW"];
      if (status && !allowedDealerStatuses.includes(status)) {
        return NextResponse.json({ success: false, message: "Đại lý không được phép đặt trạng thái này." }, { status: 403 });
      }
      if (body.dealerId && body.dealerId !== current.dealerId) {
        return NextResponse.json({ success: false, message: "Không được chuyển lệnh sang đại lý khác." }, { status: 403 });
      }
    }
    if (auth.user.role === "KTV") {
      if (status && !["ACCEPTED", "IN_PROGRESS"].includes(status)) {
        return NextResponse.json({ success: false, message: "KTV chỉ được nhận lệnh hoặc bắt đầu xử lý." }, { status: 403 });
      }
      if ("dealerId" in body || "technicianId" in body) {
        return NextResponse.json({ success: false, message: "KTV không được thay đổi phân công." }, { status: 403 });
      }
    }

    const rejected = ["DEALER", "CTV"].includes(auth.user.role) && status === "NEW" && body.dealerId === null;
    const dueDate = status === "CALLED_NO_ANSWER"
      ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      : body.dueDate === null || body.dueDate === ""
        ? null
        : body.dueDate
          ? new Date(body.dueDate)
          : undefined;
    const serviceFee = body.serviceFee === null || body.serviceFee === ""
      ? null
      : Number.isFinite(Number(body.serviceFee))
        ? Number(body.serviceFee)
        : undefined;

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

    if (status === "CUSTOMER_REJECTED" && current.maintenanceScheduleId) {
      await prisma.maintenanceSchedule.update({ where: { id: current.maintenanceScheduleId }, data: { status: "DISABLED" } });
    }
    if (status === "CUSTOMER_SELF_SERVICE" && current.maintenanceScheduleId) {
      await prisma.maintenanceSchedule.update({ where: { id: current.maintenanceScheduleId }, data: { status: "SELF_SERVICE" } });
    }

    if (status && status !== current.status && order.machine.customer) {
      await queueServiceStatusEmail({
        customer: order.machine.customer,
        orderCode: order.orderCode,
        machineId: order.machineId,
        status,
        serviceType: order.serviceType,
      });
    }

    return NextResponse.json({ success: true, message: "Đã cập nhật lệnh dịch vụ.", data: order });
  } catch (error) {
    console.error("PUT /api/service-orders/[id] failed", error);
    return NextResponse.json({ success: false, message: databaseErrorMessage(error, "Không cập nhật được lệnh dịch vụ.") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được xóa lệnh." }, { status: 403 });
  try {
    const { id } = await params;
    await prisma.serviceOrder.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Đã xóa lệnh dịch vụ." });
  } catch {
    return NextResponse.json({ success: false, message: "Không xóa được lệnh dịch vụ." }, { status: 500 });
  }
}
