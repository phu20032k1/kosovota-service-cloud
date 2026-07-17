import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { queueMaintenanceReminderEmail } from "@/lib/notifications/events";

function hasCronSecret(request: NextRequest) {
  const configured = process.env.CRON_SECRET;
  if (!configured) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return request.headers.get("x-cron-secret") === configured || bearer === configured;
}

export async function POST(request: NextRequest) {
  const cronAuthorized = hasCronSecret(request);
  const auth = cronAuthorized ? true : Boolean(await hasRole(request, ["ADMIN", "CSKH"]));
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin/CSKH hoặc cron hợp lệ được tạo nhắc lịch." }, { status: 403 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const days = Math.min(Math.max(Number(body.days) || 7, 1), 30);
  const now = new Date();
  const dueTo = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const schedules = await prisma.maintenanceSchedule.findMany({
    where: {
      status: "PENDING",
      dueDate: { gte: now, lte: dueTo },
      machine: { customer: { email: { not: null } } },
    },
    include: { machine: { include: { customer: true } } },
    orderBy: { dueDate: "asc" },
    take: 200,
  });

  let queued = 0;
  let skipped = 0;
  for (const schedule of schedules) {
    const exists = await prisma.notification.findFirst({
      where: { kind: "MAINTENANCE_REMINDER", payload: { contains: schedule.id }, status: { in: ["PENDING", "PROCESSING", "SENT"] } },
      select: { id: true },
    });
    if (exists) {
      skipped += 1;
      continue;
    }
    if (!schedule.machine.customer) continue;
    await queueMaintenanceReminderEmail({
      scheduleId: schedule.id,
      machineId: schedule.machineId,
      title: schedule.title,
      dueDate: schedule.dueDate,
      customer: schedule.machine.customer,
    });
    queued += 1;
  }

  return NextResponse.json({ success: true, message: `Đã tạo ${queued} email nhắc lịch bảo trì.`, data: { queued, skipped, scanned: schedules.length, days } });
}
