import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { databaseErrorMessage } from "@/lib/database-errors";

const CLOSED_CURRENT = ["COMPLETED", "DISABLED", "SELF_SERVICE", "INTERNAL"];
const CARED_STATUSES = new Set([
  "CALLED_NO_ANSWER",
  "CUSTOMER_ACCEPTED",
  "CUSTOMER_SELF_SERVICE",
  "CUSTOMER_INTERNAL",
  "CUSTOMER_REJECTED",
  "RESCHEDULED",
  "COMPLAINT",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
]);
const CARE_ACTIVITY_MARKER = /\[service-order:([^\]]+)\]/;

function vnDayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function vnHour(value: Date) {
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(value));
}

function addDays(key: string, delta: number) {
  const date = new Date(`${key}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function startOfVnDay(key: string) {
  return new Date(`${key}T00:00:00+07:00`);
}

function endOfVnDay(key: string) {
  return new Date(`${key}T23:59:59.999+07:00`);
}

function orderIdFromActivity(detail?: string | null) {
  return detail?.match(CARE_ACTIVITY_MARKER)?.[1] || null;
}

function uniqueSize(values: string[]) {
  return new Set(values.filter(Boolean)).size;
}

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["SUPER_ADMIN", "ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  try {
    const rawPeriod = Number(request.nextUrl.searchParams.get("period") || "7");
    const period = rawPeriod === 14 || rawPeriod === 30 ? rawPeriod : 7;
    const todayKey = vnDayKey(new Date());
    const startKey = addDays(todayKey, -(period - 1));
    const periodStart = startOfVnDay(startKey);
    const periodEnd = endOfVnDay(todayKey);

    const [
      trackedMachines,
      dueSchedules,
      periodSchedules,
      periodActivities,
      periodReports,
      cskhUsers,
    ] = await Promise.all([
      prisma.machine.findMany({
        where: {
          OR: [
            { installDate: { not: null } },
            { activations: { some: { step: 2 } } },
          ],
        },
        select: { id: true },
        take: 10000,
      }),
      prisma.maintenanceSchedule.findMany({
        where: {
          dueDate: { lte: periodEnd },
          status: { notIn: CLOSED_CURRENT },
        },
        select: {
          id: true,
          machineId: true,
          title: true,
          dueDate: true,
          status: true,
          serviceOrder: {
            select: {
              id: true,
              status: true,
              dealerId: true,
              updatedAt: true,
              reports: { select: { id: true, createdAt: true }, take: 1 },
            },
          },
        },
        orderBy: { dueDate: "asc" },
        take: 10000,
      }),
      prisma.maintenanceSchedule.findMany({
        where: {
          dueDate: { gte: periodStart, lte: periodEnd },
          status: { not: "DISABLED" },
        },
        select: { id: true, machineId: true, dueDate: true, title: true, status: true },
        orderBy: { dueDate: "asc" },
        take: 10000,
      }),
      prisma.customerActivity.findMany({
        where: {
          type: "CARE_RESULT",
          occurredAt: { gte: periodStart, lte: periodEnd },
        },
        select: { id: true, customerId: true, summary: true, detail: true, userId: true, occurredAt: true },
        orderBy: { occurredAt: "asc" },
        take: 20000,
      }),
      prisma.serviceReport.findMany({
        where: { createdAt: { gte: periodStart, lte: periodEnd } },
        select: { id: true, machineId: true, orderId: true, serviceType: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 20000,
      }),
      prisma.user.findMany({
        where: { role: "CSKH", active: true },
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const linkedOrderIds = [...new Set(periodActivities.map((item) => orderIdFromActivity(item.detail)).filter((id): id is string => Boolean(id)))];
    const linkedOrders = linkedOrderIds.length
      ? await prisma.serviceOrder.findMany({
          where: { id: { in: linkedOrderIds } },
          select: {
            id: true,
            machineId: true,
            status: true,
            dealerId: true,
            reports: { select: { id: true }, take: 1 },
          },
        })
      : [];
    const linkedOrderMap = new Map(linkedOrders.map((order) => [order.id, order]));

    const dueMachineIds = dueSchedules.map((item) => item.machineId);
    const caredMachineIds = dueSchedules
      .filter((item) => item.serviceOrder && CARED_STATUSES.has(item.serviceOrder.status))
      .map((item) => item.machineId);
    const assignedMachineIds = dueSchedules
      .filter((item) => Boolean(item.serviceOrder?.dealerId))
      .map((item) => item.machineId);
    const servicedMachineIds = dueSchedules
      .filter((item) => item.serviceOrder?.status === "COMPLETED" || Boolean(item.serviceOrder?.reports.length))
      .map((item) => item.machineId);

    const metrics = {
      tracked: uniqueSize(trackedMachines.map((item) => item.id)),
      due: uniqueSize(dueMachineIds),
      dueTasks: dueSchedules.length,
      cared: uniqueSize(caredMachineIds),
      assigned: uniqueSize(assignedMachineIds),
      serviced: uniqueSize(servicedMachineIds),
    };

    const trend = Array.from({ length: period }, (_, index) => {
      const key = addDays(startKey, index);
      const daySchedules = periodSchedules.filter((item) => vnDayKey(item.dueDate) === key);
      const dayActivities = periodActivities.filter((item) => vnDayKey(item.occurredAt) === key);
      const dayReports = periodReports.filter((item) => vnDayKey(item.createdAt) === key);
      const caredMachines = dayActivities
        .map((item) => orderIdFromActivity(item.detail))
        .map((id) => (id ? linkedOrderMap.get(id)?.machineId || "" : ""))
        .filter(Boolean);
      return {
        date: key,
        dueMachines: uniqueSize(daySchedules.map((item) => item.machineId)),
        dueTasks: daySchedules.length,
        careActions: dayActivities.length,
        caredMachines: uniqueSize(caredMachines),
        servicedMachines: uniqueSize(dayReports.map((item) => item.machineId)),
        serviceReports: dayReports.length,
      };
    });

    const hourly = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      careActions: periodActivities.filter((item) => vnHour(item.occurredAt) === hour).length,
    }));

    const outcomeMap = new Map<string, number>();
    for (const activity of periodActivities) {
      const label = activity.summary?.trim() || "Chưa phân loại";
      outcomeMap.set(label, (outcomeMap.get(label) || 0) + 1);
    }
    const careOutcomes = [...outcomeMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "vi"));

    const serviceTypeMap = new Map<string, number>();
    for (const report of periodReports) {
      const label = report.serviceType?.trim() || "Dịch vụ khác";
      serviceTypeMap.set(label, (serviceTypeMap.get(label) || 0) + 1);
    }
    const serviceTypes = [...serviceTypeMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "vi"));

    const agentRows = cskhUsers.map((user) => {
      const activities = periodActivities.filter((item) => item.userId === user.id);
      const orderIds = [...new Set(activities.map((item) => orderIdFromActivity(item.detail)).filter((id): id is string => Boolean(id)))];
      const orders = orderIds.map((id) => linkedOrderMap.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
      const machineIds = orders.map((order) => order.machineId);
      const accepted = activities.filter((item) => /tiếp nhận|dịch vụ/i.test(item.summary)).length;
      const assigned = uniqueSize(orders.filter((order) => Boolean(order.dealerId)).map((order) => order.machineId));
      const serviced = uniqueSize(orders.filter((order) => order.status === "COMPLETED" || Boolean(order.reports.length)).map((order) => order.machineId));
      const lastActivity = activities.length ? activities[activities.length - 1].occurredAt.toISOString() : null;
      return {
        id: user.id,
        name: user.name,
        phone: user.phone,
        careActions: activities.length,
        machines: uniqueSize(machineIds),
        accepted,
        assigned,
        serviced,
        lastActivity,
      };
    }).sort((a, b) => b.careActions - a.careActions || b.serviced - a.serviced || a.name.localeCompare(b.name, "vi"));

    return NextResponse.json({
      success: true,
      data: {
        period,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        generatedAt: new Date().toISOString(),
        metrics,
        trend,
        hourly,
        careOutcomes,
        serviceTypes,
        agents: agentRows,
      },
    });
  } catch (error) {
    console.error("GET /api/cskh/dashboard failed", error);
    return NextResponse.json({ success: false, message: databaseErrorMessage(error, "Không tải được dữ liệu quản trị CSKH.") }, { status: 500 });
  }
}
