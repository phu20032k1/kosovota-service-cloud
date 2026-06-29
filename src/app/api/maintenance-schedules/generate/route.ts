import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { buildMaintenanceSchedules } from "@/lib/maintenance";

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  try {
    const body = await request.json();
    const machineId = typeof body.machineId === "string" ? body.machineId.trim() : "";
    if (!machineId) return NextResponse.json({ success: false, message: "Thiếu ID máy." }, { status: 400 });

    const machine = await prisma.machine.findUnique({ where: { id: machineId }, select: { id: true, model: true, installDate: true } });
    if (!machine) return NextResponse.json({ success: false, message: "Không tìm thấy máy." }, { status: 404 });
    const requested = typeof body.startDate === "string" ? new Date(body.startDate) : null;
    if (requested && Number.isNaN(requested.getTime())) return NextResponse.json({ success: false, message: "Ngày bắt đầu không hợp lệ." }, { status: 400 });
    const startDate = requested || machine.installDate;
    if (!startDate) return NextResponse.json({ success: false, message: "Máy chưa có ngày lắp đặt." }, { status: 409 });

    const schedules = await prisma.$transaction(async (tx) => {
      const activeOrders = await tx.serviceOrder.count({ where: { machineId, status: { notIn: ["COMPLETED", "CANCELLED"] } } });
      if (activeOrders) throw new Error("ACTIVE_ORDERS");
      await tx.maintenanceSchedule.deleteMany({ where: { machineId } });
      await tx.maintenanceSchedule.createMany({ data: buildMaintenanceSchedules(machineId, startDate, machine.model) });
      return tx.maintenanceSchedule.findMany({ where: { machineId }, orderBy: { dueDate: "asc" } });
    });
    return NextResponse.json({ success: true, message: "Đã tạo lịch chăm sóc theo dòng sản phẩm.", data: schedules });
  } catch (error) {
    const active = error instanceof Error && error.message === "ACTIVE_ORDERS";
    return NextResponse.json({ success: false, message: active ? "Máy đang có lệnh chưa hoàn tất, không thể tạo lại lịch." : "Không thể tạo lịch bảo trì." }, { status: active ? 409 : 500 });
  }
}
