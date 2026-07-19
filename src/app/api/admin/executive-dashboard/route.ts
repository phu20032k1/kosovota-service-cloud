import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";

const CLOSED_ORDER_STATUSES = ["COMPLETED", "CANCELLED"];

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được xem báo cáo lãnh đạo." }, { status: 403 });

  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const in30Days = new Date(now);
  in30Days.setDate(in30Days.getDate() + 30);

  const [
    machines,
    totalMachines,
    customers,
    dealers,
    ordersMonth,
    ordersPrev,
    overdueSchedules,
    overdueScheduleRows,
    upcomingSchedules,
    openTickets,
    criticalTickets,
    inventoryValueRows,
    lowStockRows,
    paymentBatches,
    provinceRows,
    topDealers,
    dueMachineRows,
    caredMachineRows,
    servedMachineRows,
    activeOrders,
    completedOrders,
    orderStatusRows,
    ticketStatusRows,
    trendOrders,
    trendReports,
  ] = await Promise.all([
    prisma.machine.count({ where: { customerId: { not: null } } }),
    prisma.machine.count(),
    prisma.customer.count(),
    prisma.dealer.count({ where: { status: "APPROVED" } }),
    prisma.serviceOrder.findMany({ where: { createdAt: { gte: startMonth } }, select: { status: true, serviceFee: true } }),
    prisma.serviceOrder.findMany({ where: { createdAt: { gte: startPrevMonth, lt: startMonth } }, select: { status: true, serviceFee: true } }),
    prisma.maintenanceSchedule.count({ where: { dueDate: { lt: now }, status: { not: "COMPLETED" } } }),
    prisma.maintenanceSchedule.findMany({
      where: { dueDate: { lt: now }, status: { not: "COMPLETED" } },
      include: { machine: { include: { customer: true } } },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    prisma.maintenanceSchedule.count({ where: { dueDate: { gte: now, lte: in30Days }, status: { not: "COMPLETED" } } }),
    prisma.supportTicket.count({ where: { status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] } } }),
    prisma.supportTicket.count({ where: { priority: "CRITICAL", status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] } } }),
    prisma.stockBalance.findMany({ include: { item: true } }),
    prisma.stockBalance.findMany({ where: { quantity: { lte: 5 } }, include: { item: true, warehouse: true }, take: 20 }),
    prisma.paymentBatch.findMany({ select: { status: true, netAmount: true } }),
    prisma.machine.groupBy({ by: ["provinceCode"], _count: { _all: true }, orderBy: { _count: { provinceCode: "desc" } }, take: 10 }),
    prisma.dealer.findMany({ where: { status: "APPROVED" }, include: { serviceOrders: { where: { status: "COMPLETED" }, select: { serviceFee: true } } }, orderBy: { rating: "desc" }, take: 10 }),
    prisma.maintenanceSchedule.findMany({
      where: { dueDate: { lte: in30Days }, status: { not: "COMPLETED" } },
      distinct: ["machineId"],
      select: { machineId: true },
    }),
    prisma.maintenanceSchedule.findMany({ where: { status: "COMPLETED" }, distinct: ["machineId"], select: { machineId: true } }),
    prisma.serviceReport.findMany({ distinct: ["machineId"], select: { machineId: true } }),
    prisma.serviceOrder.count({ where: { status: { notIn: CLOSED_ORDER_STATUSES } } }),
    prisma.serviceOrder.count({ where: { status: "COMPLETED" } }),
    prisma.serviceOrder.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { _count: { status: "desc" } } }),
    prisma.supportTicket.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { _count: { status: "desc" } } }),
    prisma.serviceOrder.findMany({
      where: { createdAt: { gte: trendStart } },
      select: { createdAt: true, status: true, serviceFee: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.serviceReport.findMany({ where: { createdAt: { gte: trendStart } }, select: { createdAt: true } }),
  ]);

  const revenueMonth = ordersMonth.filter((order) => order.status === "COMPLETED").reduce((sum, order) => sum + (order.serviceFee || 0), 0);
  const revenuePrev = ordersPrev.filter((order) => order.status === "COMPLETED").reduce((sum, order) => sum + (order.serviceFee || 0), 0);
  const inventoryValue = inventoryValueRows.reduce((sum, row) => sum + row.quantity * row.item.costPrice, 0);
  const paid = paymentBatches.filter((batch) => batch.status === "PAID").reduce((sum, batch) => sum + batch.netAmount, 0);
  const payable = paymentBatches.filter((batch) => ["SUBMITTED", "APPROVED"].includes(batch.status)).reduce((sum, batch) => sum + batch.netAmount, 0);

  const trend = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(trendStart.getFullYear(), trendStart.getMonth() + index, 1);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const monthOrders = trendOrders.filter((order) => order.createdAt.getFullYear() === year && order.createdAt.getMonth() === month);
    const reportCount = trendReports.filter((report) => report.createdAt.getFullYear() === year && report.createdAt.getMonth() === month).length;
    return {
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: `T${month + 1}/${String(year).slice(-2)}`,
      created: monthOrders.length,
      completed: monthOrders.filter((order) => order.status === "COMPLETED").length,
      reports: reportCount,
      revenue: monthOrders.filter((order) => order.status === "COMPLETED").reduce((sum, order) => sum + (order.serviceFee || 0), 0),
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      kpis: {
        machines,
        totalMachines,
        customers,
        dealers,
        revenueMonth,
        revenuePrev,
        overdueSchedules,
        upcomingSchedules,
        openTickets,
        criticalTickets,
        inventoryValue,
        paid,
        payable,
      },
      careFunnel: {
        customerMachines: machines,
        dueMachines: dueMachineRows.length,
        caredMachines: caredMachineRows.length,
        servedMachines: servedMachineRows.length,
        activeOrders,
        completedOrders,
      },
      orderStatuses: orderStatusRows.map((row) => ({ status: row.status, count: row._count._all })),
      ticketStatuses: ticketStatusRows.map((row) => ({ status: row.status, count: row._count._all })),
      trend,
      provinceRows,
      lowStockRows,
      overdueSchedules: overdueScheduleRows.map((schedule) => ({
        id: schedule.id,
        title: schedule.title,
        dueDate: schedule.dueDate,
        status: schedule.status,
        machineId: schedule.machineId,
        machineName: schedule.machine.name || schedule.machine.model,
        customerName: schedule.machine.customer?.name || null,
        customerPhone: schedule.machine.customer?.phone || null,
      })),
      topDealers: topDealers.map((dealer) => ({
        id: dealer.id,
        dealerCode: dealer.dealerCode,
        name: dealer.name,
        rating: dealer.rating,
        completed: dealer.serviceOrders.length,
        revenue: dealer.serviceOrders.reduce((sum, order) => sum + (order.serviceFee || 0), 0),
      })),
    },
  });
}
