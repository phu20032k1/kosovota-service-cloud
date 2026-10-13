import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { queueMaintenanceReminderEmail } from "@/lib/notifications/events";
import { generateDueMaintenanceOrders, syncMissingMaintenanceSchedules } from "@/lib/maintenance-automation";
import { normalizeUserProvinceScopes } from "@/lib/data-normalization";

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

  // Cron tự chuẩn hóa dữ liệu tỉnh, bù lịch còn thiếu và sinh lệnh đến hạn.
  // Lệnh được sinh trước để đại lý nhận việc ngay; truy vấn nhắc lịch bên dưới
  // vẫn giữ ORDER_CREATED để việc tạo lệnh không vô tình làm mất nhắc lịch khách.
  const provinceNormalization = await normalizeUserProvinceScopes(1_000);
  const maintenanceSync = await syncMissingMaintenanceSchedules(1_000);
  const orderGeneration = await generateDueMaintenanceOrders(new Date(), 1_000);

  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueTo = new Date(today);
  dueTo.setDate(dueTo.getDate() + days + 1);

  // Không đặt gte: lịch quá hạn vẫn phải được quét và nhắc. ORDER_CREATED vẫn
  // cần nhắc vì đây chỉ là trạng thái lệnh đã được sinh, không phải khách đã được
  // thông báo. Dedupe notification ngăn một lịch bị xếp email nhiều lần.
  const schedules = await prisma.maintenanceSchedule.findMany({
    where: {
      status: { in: ["PENDING", "ORDER_CREATED"] },
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
    message: `Đã chuẩn hóa ${provinceNormalization.updated} phạm vi tỉnh, tự đồng bộ ${maintenanceSync.createdSchedules} lịch, sinh ${orderGeneration.created} lệnh đến hạn (${orderGeneration.assigned} đã giao đại lý, ${orderGeneration.unassigned} chờ điều phối) và tạo ${queued} email nhắc lịch; bỏ qua ${skipped} thông báo đã có.`,
    data: {
      queued,
      skipped,
      scanned: schedules.length,
      days,
      overdue,
      today: todayCount,
      upcoming,
      provinceNormalization,
      maintenanceSync,
      orderGeneration,
    },
  });
}

export async function GET(request: NextRequest) {
  return run(request, request.nextUrl.searchParams.get("days"));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  return run(request, body.days);
}
