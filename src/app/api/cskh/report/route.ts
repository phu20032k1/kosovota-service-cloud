import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { careStatusLabel, monthsBetween, serviceResultLabel, splitVietnamAddress } from "@/lib/cskh-report";
import { expandProvinceScope, provinceName } from "@/lib/province";
import { databaseErrorMessage } from "@/lib/database-errors";

const CARE_ACTIVITY_MARKER = /\[service-order:([^\]]+)\]/;
const FINISHED = new Set(["COMPLETED", "CANCELLED"]);

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
    const orders = await prisma.serviceOrder.findMany({
      where: {
        status: { not: "CANCELLED" },
        ...(scope.length ? { machine: { provinceCode: { in: scope } } } : {}),
      },
      include: {
        dealer: { select: { id: true, dealerCode: true, name: true, phone: true } },
        technician: { select: { id: true, name: true } },
        reports: { orderBy: { createdAt: "desc" }, take: 5 },
        maintenanceSchedule: true,
        sourceTicket: { include: { assignee: { select: { id: true, name: true } } } },
        machine: {
          include: {
            customer: { include: { owner: { select: { id: true, name: true } } } },
            activations: { orderBy: { createdAt: "desc" }, take: 1 },
            maintenanceSchedules: { orderBy: { dueDate: "asc" } },
            serviceReports: { orderBy: { createdAt: "desc" }, take: 5 },
          },
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 1500,
    });

    const customerIds = [...new Set(orders.map((order) => order.machine.customer?.id).filter((id): id is string => Boolean(id)))];
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
      const rows = activitiesByCustomer.get(activity.customerId) || [];
      rows.push(activity);
      activitiesByCustomer.set(activity.customerId, rows);
    }

    const rows = orders.map((order) => {
      const customer = order.machine.customer;
      const activation = order.machine.activations[0] || null;
      const province = provinceName(order.machine.provinceCode) || "";
      const address = customer?.address || order.address || "";
      const splitAddress = splitVietnamAddress(address, province);
      const careActivity = activityByOrder.get(order.id) || null;
      const customerActivities = customer ? activitiesByCustomer.get(customer.id) || [] : [];
      const previousCare = customerActivities.find((activity) => orderIdFromActivity(activity.detail) !== order.id) || null;
      const latestReport = order.reports[0] || order.machine.serviceReports[0] || null;
      const nextSchedule = order.machine.maintenanceSchedules.find((schedule) =>
        !["COMPLETED", "DISABLED", "SELF_SERVICE", "INTERNAL"].includes(schedule.status)
        && schedule.dueDate.getTime() >= Date.now() - 24 * 60 * 60 * 1000,
      ) || null;
      const activationDate = order.machine.installDate || activation?.createdAt || null;
      const currentCareResult = careActivity?.summary || careStatusLabel(order.status);
      const previousCareResult = previousCare?.summary || "";
      const lastCareDate = previousCare?.occurredAt || customer?.lastContactAt || null;
      const lastCareWork = order.machine.serviceReports.find((report) => report.id !== latestReport?.id)?.serviceType
        || (previousCare ? previousCare.summary : "")
        || "";
      const cskhName = (careActivity?.userId ? userName.get(careActivity.userId) : null)
        || order.sourceTicket?.assignee?.name
        || (auth.user.role === "CSKH" ? auth.user.name : "")
        || "";
      const reportCount = latestReport ? Math.max(1, order.reports.length) : 0;

      return {
        id: order.id,
        orderCode: order.orderCode,
        date: iso(order.dueDate || order.createdAt),
        machineId: order.machineId,
        machineCode: order.machine.serial || order.machine.id,
        customerId: customer?.id || "",
        customerName: customer?.name || order.customerName,
        customerPhone: customer?.phone || order.customerPhone,
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
        nextCareTitle: nextSchedule?.title || order.serviceType || "",
        nextCareDate: iso(nextSchedule?.dueDate || order.dueDate),
        currentCareResult,
        dealerId: order.dealer?.id || null,
        dealerCode: order.dealer?.dealerCode || "",
        dealerName: order.dealer?.name || "",
        serviceResult: serviceResultLabel({
          status: order.status,
          reportServiceType: latestReport?.serviceType,
          products: latestReport?.products,
          dealerCode: order.dealer?.dealerCode,
        }),
        serviceType: order.serviceType,
        status: order.status,
        reportCount,
        updatedAt: order.updatedAt.toISOString(),
      };
    });

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const due = new Set(rows.filter((row) => {
      const careDate = row.nextCareDate || row.date;
      return Boolean(careDate && new Date(careDate) <= todayEnd && !FINISHED.has(row.status));
    }).map((row) => row.machineId)).size;
    const cared = new Set(rows.filter((row) => Boolean(row.currentCareResult)).map((row) => row.machineId)).size;
    const serviced = new Set(rows.filter((row) => row.reportCount > 0 || row.status === "COMPLETED").map((row) => row.machineId)).size;
    const assigned = new Set(rows.filter((row) => Boolean(row.dealerCode)).map((row) => row.machineId)).size;

    return NextResponse.json({
      success: true,
      data: {
        rows,
        metrics: { total: new Set(rows.map((row) => row.machineId)).size, due, cared, serviced, assigned },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/cskh/report failed", error);
    return NextResponse.json({ success: false, message: databaseErrorMessage(error, "Không tải được báo cáo CSKH.") }, { status: 500 });
  }
}
