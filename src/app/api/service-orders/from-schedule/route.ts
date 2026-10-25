import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { createOrderCode } from "@/lib/order-code";
import { queueServiceOrderCreatedNotifications } from "@/lib/notifications/events";
import { effectiveProvinceCode, provinceScopeAllows } from "@/lib/province-access";

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["SUPER_ADMIN", "ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  try {
    const body = await request.json();
    const schedule = await prisma.maintenanceSchedule.findUnique({
      where: { id: body.scheduleId },
      include: { machine: { include: { customer: true } }, serviceOrder: true },
    });
    if (!schedule) return NextResponse.json({ success: false, message: "Không tìm thấy lịch bảo trì." }, { status: 404 });
    if (auth.user.role === "CSKH" && !provinceScopeAllows(
      auth.user.provinceScope,
      schedule.machine.provinceCode,
      schedule.machine.customer?.address,
    )) {
      return NextResponse.json({ success: false, message: "Lịch nằm ngoài phạm vi được phân công." }, { status: 403 });
    }
    if (schedule.serviceOrder) return NextResponse.json({ success: true, message: "Lịch này đã có lệnh.", data: schedule.serviceOrder });
    if (!schedule.machine.customer?.phone) return NextResponse.json({ success: false, message: "Máy chưa có khách hàng." }, { status: 409 });

    const code = await createOrderCode(effectiveProvinceCode(
      schedule.machine.provinceCode,
      schedule.machine.customer?.address,
    ) || "01");
    const order = await prisma.$transaction(async (tx) => {
      const current = await tx.maintenanceSchedule.findUnique({
        where: { id: schedule.id },
        include: { serviceOrder: true },
      });
      if (!current) throw new Error("Lịch không còn tồn tại.");
      if (current.serviceOrder) return current.serviceOrder;

      const created = await tx.serviceOrder.create({
        data: {
          orderCode: code,
          machineId: schedule.machineId,
          maintenanceScheduleId: schedule.id,
          dealerId: typeof body.dealerId === "string" ? body.dealerId : null,
          customerName: schedule.machine.customer?.name || "Khách hàng KOSOVOTA",
          customerPhone: schedule.machine.customer?.phone || "",
          address: schedule.machine.customer?.address || null,
          serviceType: schedule.title,
          status: typeof body.dealerId === "string" ? "ASSIGNED" : "NEW",
          dueDate: schedule.dueDate,
          serviceFee: Number.isFinite(Number(body.serviceFee)) ? Number(body.serviceFee) : null,
        },
      });
      await tx.maintenanceSchedule.update({ where: { id: schedule.id }, data: { status: "ORDER_CREATED" } });
      return created;
    });
    if (schedule.machine.customer) {
      await queueServiceOrderCreatedNotifications({
        orderCode: order.orderCode,
        machineId: order.machineId,
        serviceType: order.serviceType,
        dueDate: order.dueDate,
        customer: schedule.machine.customer,
      });
    }
    return NextResponse.json({ success: true, message: "Đã tạo lệnh từ lịch bảo trì.", data: order }, { status: 201 });
  } catch (error) {
    console.error("from schedule failed", error);
    return NextResponse.json({ success: false, message: "Không tạo được lệnh từ lịch." }, { status: 500 });
  }
}
