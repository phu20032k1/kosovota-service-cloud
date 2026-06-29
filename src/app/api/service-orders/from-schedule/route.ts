import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { createOrderCode } from "@/lib/order-code";

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  try {
    const body = await request.json();
    const schedule = await prisma.maintenanceSchedule.findUnique({
      where: { id: body.scheduleId },
      include: { machine: { include: { customer: true } }, serviceOrder: true },
    });
    if (!schedule) return NextResponse.json({ success: false, message: "Không tìm thấy lịch bảo trì." }, { status: 404 });
    if (schedule.serviceOrder) return NextResponse.json({ success: true, message: "Lịch này đã có lệnh.", data: schedule.serviceOrder });
    if (!schedule.machine.customer?.phone) return NextResponse.json({ success: false, message: "Máy chưa có khách hàng." }, { status: 409 });

    const code = await createOrderCode(schedule.machine.provinceCode || "01");
    const order = await prisma.$transaction(async (tx) => {
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
    return NextResponse.json({ success: true, message: "Đã tạo lệnh từ lịch bảo trì.", data: order }, { status: 201 });
  } catch (error) {
    console.error("from schedule failed", error);
    return NextResponse.json({ success: false, message: "Không tạo được lệnh từ lịch." }, { status: 500 });
  }
}
