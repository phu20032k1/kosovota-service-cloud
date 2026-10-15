import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { queueMaintenanceReminderEmail } from "@/lib/notifications/events";
import { processNotificationQueue } from "@/lib/notifications/process";
import { generateDueMaintenanceOrders, syncMissingMaintenanceSchedules } from "@/lib/maintenance-automation";
import { endOfVietnamCalendarDay } from "@/lib/maintenance-time";
import { normalizeStoredProvinceData } from "@/lib/data-normalization";
import { geocodeMissingDealerCoordinates, reconcileDealerProfiles } from "@/lib/data-integrity";

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

  // Một lượt cron phải tự khép kín toàn bộ luồng cốt lõi: sửa dữ liệu có thể
  // suy ra chắc chắn, bổ sung GPS, bù lịch, sinh lệnh, tạo nhắc và gửi hàng đợi.
  const provinceNormalization = await normalizeStoredProvinceData(1_000);
  const dealerIntegrity = await reconcileDealerProfiles(1_000);
  const dealerGeocoding = await geocodeMissingDealerCoordinates(20);
  const maintenanceSync = await syncMissingMaintenanceSchedules(1_000);
  // Lịch bảo trì là dữ liệu theo ngày. Cron có thể chạy vào buổi sáng Việt Nam,
  // vì vậy phải quét hết ngày lịch hiện tại thay vì chỉ lấy đúng thời điểm chạy.
  const orderGeneration = await generateDueMaintenanceOrders(endOfVietnamCalendarDay(new Date()), 1_000);

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

  let notificationDelivery: Awaited<ReturnType<typeof processNotificationQueue>> | null = null;
  let notificationDeliveryError: string | null = null;
  try {
    notificationDelivery = await processNotificationQueue(100);
  } catch (error) {
    notificationDeliveryError = error instanceof Error ? error.message : "Không xử lý được hàng đợi thông báo.";
    console.error("maintenance notification queue failed", error);
  }

  const simulatedText = notificationDelivery?.simulated
    ? `; ${notificationDelivery.simulated} thông báo chỉ mô phỏng, chưa gửi thật`
    : "";

  return NextResponse.json({
    success: true,
    message: `Đã chuẩn hóa ${provinceNormalization.updated} dữ liệu tỉnh/thành, bổ sung ${dealerIntegrity.created} hồ sơ đại lý, cập nhật GPS ${dealerGeocoding.updated} đại lý, đồng bộ ${maintenanceSync.createdSchedules} lịch, sinh ${orderGeneration.created} lệnh (${orderGeneration.assigned} đã giao đại lý, ${orderGeneration.unassigned} chờ điều phối), tạo ${queued} nhắc lịch và gửi thật ${notificationDelivery?.sent || 0} thông báo${simulatedText}.`,
    data: {
      queued,
      skipped,
      scanned: schedules.length,
      days,
      overdue,
      today: todayCount,
      upcoming,
      provinceNormalization,
      dealerIntegrity,
      dealerGeocoding,
      maintenanceSync,
      orderGeneration,
      notificationDelivery,
      notificationDeliveryError,
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
