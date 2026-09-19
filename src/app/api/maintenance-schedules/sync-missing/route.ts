import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { buildMaintenanceSchedules } from "@/lib/maintenance";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) {
    return NextResponse.json(
      { success: false, message: "Chỉ Admin được đồng bộ lịch còn thiếu." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const limit = Math.min(1_000, Math.max(1, Number(body.limit) || 500));
  const machines = await prisma.machine.findMany({
    where: { installDate: { not: null }, maintenanceSchedules: { none: {} } },
    select: { id: true, model: true, installDate: true },
    orderBy: { installDate: "asc" },
    take: limit,
  });

  let createdSchedules = 0;
  const syncedMachineIds: string[] = [];
  const failed: Array<{ machineId: string; reason: string }> = [];

  for (const machine of machines) {
    if (!machine.installDate) continue;
    const schedules = buildMaintenanceSchedules(machine.id, machine.installDate, machine.model);
    try {
      const result = await prisma.maintenanceSchedule.createMany({ data: schedules });
      if (result.count) {
        createdSchedules += result.count;
        syncedMachineIds.push(machine.id);
      }
    } catch (error) {
      failed.push({
        machineId: machine.id,
        reason: error instanceof Error ? error.message : "Không tạo được lịch.",
      });
    }
  }

  const remaining = await prisma.machine.count({
    where: { installDate: { not: null }, maintenanceSchedules: { none: {} } },
  });
  await prisma.adminLog.create({
    data: {
      userId: auth.user.id,
      action: "SYNC_MISSING_MAINTENANCE_SCHEDULES",
      detail: `Máy đồng bộ ${syncedMachineIds.length}; lịch tạo ${createdSchedules}; lỗi ${failed.length}; còn lại ${remaining}`,
    },
  });

  return NextResponse.json({
    success: true,
    message: `Đã sinh ${createdSchedules} lịch cho ${syncedMachineIds.length} máy. Còn ${remaining} máy cần kiểm tra.`,
    data: { scanned: machines.length, synced: syncedMachineIds.length, createdSchedules, remaining, failed },
  });
}
