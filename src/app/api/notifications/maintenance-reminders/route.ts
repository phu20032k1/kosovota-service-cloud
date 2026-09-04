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

function startOfDay(value = new Date()) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

async function authorize(request: NextRequest) {
  if (hasCronSecret(request)) return true;
  return Boolean(await hasRole(request, ["ADMIN", "CSKH"]));
}

async function run(request: NextRequest, daysInput?: unknown) {
  if (!(await authorize(request))) {
    return NextResponse.json(
      { success: false, message: "Chỉ Admin/CSKH hoặc cron hợp lệ được tạo nhắc lịch." },
      { status: 403 },
    );
  }

  const days = Math.min(Math.max(Number(daysInput) || 7, 1), 30);
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueTo = new Date(today);
  dueTo.setDate(dueTo.getDate() + days + 1);

  // Không đặt gte: lịch quá hạn vẫn phải được quét và nhắc; lệnh dedupe bên dưới
  // ngăn một lịch đã xếp hàng/gửi thành công bị tạo thông báo trùng.
  const schedules = await prisma.maintenanceSchedule.findMany({
    where: {
      status: "PENDING",
      dueDate: { lt: dueTo },
      machine: { customer: { email: { not: null } } },
    },
    include: { machine: { include: { customer: true } } },
    orderBy: { dueDate: "asc" },
    take: 1000,
  });

  let queued = 0;
  let skipped = 0;
  let overdue = 0;
  let todayCount = 0;
  let upcoming = 0;

  for (const schedule of schedules) {
    if (schedule.dueDate < today) overdue += 1;
    else if (schedule.dueDate < tomorrow) todayCount += 1;
    else upcoming += 1;

    const exists = await prisma.notification.findFirst({
      where: {
        kind: "MAINTENANCE_REMINDER",
        payload: { contains: schedule.id },
        status: { in: ["PENDING", "PROCESSING", "SENT"] },
      },
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

  return NextResponse.json({
    success: true,
    message: `Đã tạo ${queued} email nhắc lịch bảo trì; bỏ qua ${skipped} thông báo đã có.`,
    data: { queued, skipped, scanned: schedules.length, days, overdue, today: todayCount, upcoming },
  });
}

export async function GET(request: NextRequest) {
  return run(request, request.nextUrl.searchParams.get("days"));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  return run(request, body.days);
}
