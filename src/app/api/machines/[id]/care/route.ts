import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { CARE_DISABLED_ACTION, CARE_ENABLED_ACTION, getOptedOutMachineIds } from "@/lib/maintenance-optout";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được thay đổi chế độ chăm sóc máy." }, { status: 403 });
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (typeof body.disabled !== "boolean") return NextResponse.json({ success: false, message: "Thiếu trạng thái chăm sóc." }, { status: 400 });
    const machine = await prisma.machine.findUnique({ where: { id }, select: { id: true } });
    if (!machine) return NextResponse.json({ success: false, message: "Không tìm thấy máy." }, { status: 404 });

    const currentlyDisabled = (await getOptedOutMachineIds([id])).has(id);
    if (currentlyDisabled === body.disabled) return NextResponse.json({ success: true, data: { disabled: currentlyDisabled }, message: "Trạng thái chăm sóc không thay đổi." });

    if (body.disabled) {
      const schedules = await prisma.maintenanceSchedule.findMany({ where: { machineId: id, status: { in: ["PENDING", "ORDER_CREATED"] } }, select: { id: true } });
      const scheduleIds = schedules.map((item) => item.id);
      await prisma.$transaction([
        prisma.maintenanceSchedule.updateMany({ where: { id: { in: scheduleIds } }, data: { status: "DISABLED" } }),
        prisma.serviceOrder.updateMany({ where: { maintenanceScheduleId: { in: scheduleIds }, status: { in: ["NEW", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "CALLED_NO_ANSWER", "CUSTOMER_ACCEPTED", "RESCHEDULED", "COMPLAINT"] } }, data: { status: "CANCELLED" } }),
        prisma.adminLog.create({ data: { userId: auth.user.id, action: CARE_DISABLED_ACTION, target: id, detail: JSON.stringify({ scheduleIds, source: "CUSTOMER_MAP" }) } }),
      ]);
    } else {
      const logs = await prisma.adminLog.findMany({ where: { target: id, action: CARE_DISABLED_ACTION }, select: { detail: true } });
      const ids = new Set<string>();
      for (const log of logs) {
        try {
          const parsed: unknown = JSON.parse(log.detail || "{}");
          if (parsed && typeof parsed === "object" && "scheduleIds" in parsed && Array.isArray(parsed.scheduleIds)) {
            for (const scheduleId of parsed.scheduleIds) if (typeof scheduleId === "string") ids.add(scheduleId);
          }
        } catch { /* legacy audit details do not need restoration */ }
      }
      await prisma.$transaction([
        prisma.maintenanceSchedule.updateMany({ where: { machineId: id, id: { in: [...ids] }, status: "DISABLED" }, data: { status: "PENDING" } }),
        prisma.adminLog.create({ data: { userId: auth.user.id, action: CARE_ENABLED_ACTION, target: id, detail: "Admin đã bật lại chăm sóc theo yêu cầu khách hàng." } }),
      ]);
    }
    return NextResponse.json({ success: true, data: { disabled: body.disabled }, message: body.disabled ? "Đã tắt chăm sóc và lịch nhắc của máy." : "Đã bật lại chăm sóc và lịch nhắc của máy." });
  } catch (error) {
    console.error("PATCH /api/machines/[id]/care failed", error);
    return NextResponse.json({ success: false, message: "Không cập nhật được chế độ chăm sóc máy." }, { status: 500 });
  }
}
