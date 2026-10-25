import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { careStatusLabel, monthsBetween, serviceResultLabel, splitVietnamAddress } from "@/lib/cskh-report";
import { expandProvinceScope, provinceFromAddress, provinceName } from "@/lib/province";
import { databaseErrorMessage } from "@/lib/database-errors";

const CARE_ACTIVITY_MARKER = /\[service-order:([^\]]+)\]/;
const FINISHED = new Set(["COMPLETED", "CANCELLED"]);
const CLOSED_SCHEDULES = new Set(["COMPLETED", "DISABLED", "SELF_SERVICE", "INTERNAL"]);
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

function iso(value?: Date | null) {
  return value ? value.toISOString() : null;
}

function orderIdFromActivity(detail?: string | null) {
  return detail?.match(CARE_ACTIVITY_MARKER)?.[1] || null;
}

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["SUPER_ADMIN", "ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  try {
    const scope = auth.user.role === "CSKH" ? expandProvinceScope(auth.user.provinceScope) : [];

    // Lấy machineId từ đúng các nguồn nghiệp vụ đang vận hành thay vì phụ thuộc một relation filter phức tạp.
    // Nhờ vậy: máy có lịch mở trên màn hình Lịch thay lõi chắc chắn cũng là ứng viên của CSKH Report.
    const [openSchedules, completedActivations, installedMachines] = await Promise.all([
      prisma.maintenanceSchedule.findMany({
        where: { status: { notIn: Array.from(CLOSED_SCHEDULES) } },
        select: { machineId: true },
        take: 5000,
      }),
      prisma.activation.findMany({
        where: { step: 2 },
        select: { machineId: true },
        take: 5000,
      }),
      prisma.machine.findMany({
        where: { installDate: { not: null } },
        select: { id: true },
        take: 5000,
      }),
    ]);

    const candidateIds = [...new Set([
      ...openSchedules.map((item) => item.machineId),
      ...completedActivations.map((item) => item.machineId),
      ...installedMachines.map((item) => item.id),
    ])];

    const machines = candidateIds.length
      ? await prisma.machine.findMany({
          where: { id: { in: candidateIds } },
          include: {
            customer: { include: { owner: { select: { id: true, name: true } } } },
            activations: { where: { step: 2 }, orderBy: { createdAt: "desc" }, take: 1 },
            maintenanceSchedules: { orderBy: { dueDate: "asc" } },
            serviceReports: { orderBy: { createdAt: "desc" }, take: 10 },
            serviceOrders: {
              where: { status: { not: "CANCELLED" } },
              include: {
                dealer: { select: { id: true, dealerCode: true, name: true, phone: true } },
                reports: { orderBy: { createdAt: "desc" }, take: 5 },
                sourceTicket: { include: { assignee: { select: { id: true, name: true } } } },
              },
              orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
            },
          },
          orderBy: [{ installDate: "desc" }, { updatedAt: "desc" }],
        })
      : [];

    const scopedMachines = scope.length
      ? machines.filter((machine) => {
          const fallbackAddress = machine.customer?.address || machine.serviceOrders[0]?.address || "";
          const inferredCode = machine.provinceCode || provinceFromAddress(fallbackAddress)?.[1] || null;
          return Boolean(inferredCode && scope.includes(inferredCode));
        })
      : machines;

    const customerIds = [...new Set(scopedMachines.map((machine) => machine.customer?.id).filter((id): id is string => Boolean(id)))];
    const activities = customerIds.length
      ? await prisma.customerActivity.findMany({
          where: { customerId: { in: customerIds }, type: "CARE_RESULT" },
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          take: 5000,
        })
      : [];

    const userIds = [...new Set(activities.map((activity) => activity.userId).filter((id): id is string => Boolean(id)))];
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : [];
    const userName = new Map(users.map((user) => [user.id, user.name]));

    const activityByOrder = new Map<string, (typeof activities)[number]>();
    const activitiesByCustomer = new Map<string, (typeof activities)[number][]>();
    for (const activity of activities) {
      const linkedOrderId = orderIdFromActivity(activity.detail);
      if (linkedOrderId && !activityByOrder.has(linkedOrderId)) activityByOrder.set(linkedOrderId, activity);
      const customerRows = activitiesByCustomer.get(activity.customerId) || [];
      customerRows.push(activity);
      activitiesByCustomer.set(activity.customerId, customerRows);
    }

    const rows = scopedMachines.map((machine) => {
      const customer = machine.customer;
      const activation = machine.activations[0] || null;
      const nextSchedule = machine.maintenanceSchedules.find((schedule) => !CLOSED_SCHEDULES.has(schedule.status)) || null;
      const scheduleOrder = nextSchedule
        ? machine.serviceOrders.find((order) => order.maintenanceScheduleId === nextSchedule.id)
        : null;
      const order = scheduleOrder
        || machine.serviceOrders.find((item) => !FINISHED.has(item.status))
        || machine.serviceOrders[0]
        || null;

      const address = customer?.address || order?.address || "";
      const effectiveProvinceCode = machine.provinceCode || provinceFromAddress(address)?.[1] || null;
      const province = provinceName(effectiveProvinceCode) || "";
      const splitAddress = splitVietnamAddress(address, province);
      const careActivity = order ? activityByOrder.get(order.id) || null : null;
      const customerActivities = customer ? activitiesByCustomer.get(customer.id) || [] : [];
      const previousCare = customerActivities.find((activity) => !order || orderIdFromActivity(activity.detail) !== order.id) || null;
      const latestReport = order?.reports[0] || machine.serviceReports[0] || null;
      const activationDate = machine.installDate || activation?.createdAt || null;
      const currentCareResult = order ? (careActivity?.summary || careStatusLabel(order.status)) : "";
      const previousCareResult = previousCare?.summary || "";
      const lastCareDate = previousCare?.occurredAt || customer?.lastContactAt || null;
      const lastCareWork = machine.serviceReports.find((report) => report.id !== latestReport?.id)?.serviceType
        || (previousCare ? previousCare.summary : "")
        || "";
      const cskhName = (careActivity?.userId ? userName.get(careActivity.userId) : null)
        || order?.sourceTicket?.assignee?.name
        || "";
      const dueDate = order?.dueDate || nextSchedule?.dueDate || activationDate;
      const serviceType = order?.serviceType || nextSchedule?.title || "";
      const status = order?.status || "SCHEDULED";
      const reportCount = order?.reports.length || 0;

      return {
        id: order?.id || `machine:${machine.id}`,
        serviceOrderId: order?.id || null,
        orderCode: order?.orderCode || "",
        date: iso(dueDate),
        machineId: machine.id,
        machineCode: machine.serial || machine.id,
        customerId: customer?.id || "",
        customerName: customer?.name || order?.customerName || "",
        customerPhone: customer?.phone || order?.customerPhone || "",
        lastCustomerStatus: previousCareResult,
        ownerName: customer?.owner?.name || "",
        province,
        ward: splitAddress.ward,
        street: splitAddress.street || address,
        cskhName,
        activationDealerCode: activation?.dealerCode || "",
        activationDate: iso(activationDate),
        lastCareDate: iso(lastCareDate),
        lastCareWork,
        monthsSinceActivation: monthsBetween(activationDate),
        nextCareTitle: nextSchedule?.title || serviceType,
        nextCareDate: iso(nextSchedule?.dueDate || order?.dueDate),
        currentCareResult,
        dealerId: order?.dealer?.id || null,
        dealerCode: order?.dealer?.dealerCode || "",
        dealerName: order?.dealer?.name || "",
        serviceResult: order
          ? serviceResultLabel({
              status: order.status,
              reportServiceType: latestReport?.serviceType,
              products: latestReport?.products,
              dealerCode: order.dealer?.dealerCode,
            })
          : nextSchedule
            ? "Chưa đến bước thực hiện dịch vụ"
            : "Chưa có lịch chăm sóc / thay lõi",
        serviceType,
        status,
        reportCount,
        updatedAt: (order?.updatedAt || machine.updatedAt).toISOString(),
      };
    }).sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime || a.machineCode.localeCompare(b.machineCode, "vi");
    });

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const due = new Set(rows.filter((row) => row.date && new Date(row.date) <= todayEnd && !FINISHED.has(row.status)).map((row) => row.machineId)).size;
    const cared = new Set(rows.filter((row) => Boolean(row.currentCareResult) || CARED_STATUSES.has(row.status)).map((row) => row.machineId)).size;
    const serviced = new Set(rows.filter((row) => row.reportCount > 0 || row.status === "COMPLETED").map((row) => row.machineId)).size;
    const assigned = new Set(rows.filter((row) => Boolean(row.dealerCode)).map((row) => row.machineId)).size;

    return NextResponse.json({
      success: true,
      data: {
        rows,
        metrics: { total: rows.length, due, cared, serviced, assigned },
        generatedAt: new Date().toISOString(),
        sources: {
          openScheduleMachines: new Set(openSchedules.map((item) => item.machineId)).size,
          completedActivationMachines: new Set(completedActivations.map((item) => item.machineId)).size,
          installedMachines: installedMachines.length,
          candidateMachines: candidateIds.length,
          scopedMachines: scopedMachines.length,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/cskh/report failed", error);
    return NextResponse.json({ success: false, message: databaseErrorMessage(error, "Không tải được báo cáo CSKH.") }, { status: 500 });
  }
}
