import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được xem báo cáo lãnh đạo." }, { status: 403 });
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const in30Days = new Date(now); in30Days.setDate(in30Days.getDate() + 30);

  const [machines, totalMachines, customers, dealers, ordersMonth, ordersPrev, overdueSchedules, overdueScheduleRows, upcomingSchedules, openTickets, criticalTickets, inventoryValueRows, lowStockRows, paymentBatches, provinceRows, topDealers] = await Promise.all([
    prisma.machine.count({ where: { customerId: { not: null } } }), prisma.machine.count(), prisma.customer.count(), prisma.dealer.count({ where: { status: "APPROVED" } }),
    prisma.serviceOrder.findMany({ where: { createdAt: { gte: startMonth } }, select: { status: true, serviceFee: true } }),
    prisma.serviceOrder.findMany({ where: { createdAt: { gte: startPrevMonth, lt: startMonth } }, select: { status: true, serviceFee: true } }),
    prisma.maintenanceSchedule.count({ where: { dueDate: { lt: now }, status: { not: "COMPLETED" } } }),
    prisma.maintenanceSchedule.findMany({
      where: { dueDate: { lt: now }, status: { not: "COMPLETED" } },
      include: { machine: { include: { customer: true } } },
      orderBy: { dueDate: "asc" }, take: 50,
    }),
    prisma.maintenanceSchedule.count({ where: { dueDate: { gte: now, lte: in30Days }, status: { not: "COMPLETED" } } }),
    prisma.supportTicket.count({ where: { status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] } } }),
    prisma.supportTicket.count({ where: { priority: "CRITICAL", status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] } } }),
    prisma.stockBalance.findMany({ include: { item: true } }),
    prisma.stockBalance.findMany({ where: { quantity: { lte: 5 } }, include: { item: true, warehouse: true }, take: 20 }),
    prisma.paymentBatch.findMany({ select: { status: true, netAmount: true } }),
    prisma.machine.groupBy({ by: ["provinceCode"], _count: { _all: true }, orderBy: { _count: { provinceCode: "desc" } }, take: 10 }),
    prisma.dealer.findMany({ where: { status: "APPROVED" }, include: { serviceOrders: { where: { status: "COMPLETED" }, select: { serviceFee: true } } }, orderBy: { rating: "desc" }, take: 10 }),
  ]);
  const revenueMonth = ordersMonth.filter((o) => o.status === "COMPLETED").reduce((sum, o) => sum + (o.serviceFee || 0), 0);
  const revenuePrev = ordersPrev.filter((o) => o.status === "COMPLETED").reduce((sum, o) => sum + (o.serviceFee || 0), 0);
  const inventoryValue = inventoryValueRows.reduce((sum, row) => sum + row.quantity * row.item.costPrice, 0);
  const paid = paymentBatches.filter((b) => b.status === "PAID").reduce((sum, b) => sum + b.netAmount, 0);
  const payable = paymentBatches.filter((b) => ["SUBMITTED", "APPROVED"].includes(b.status)).reduce((sum, b) => sum + b.netAmount, 0);
  return NextResponse.json({ success: true, data: {
    kpis: { machines, totalMachines, customers, dealers, revenueMonth, revenuePrev, overdueSchedules, upcomingSchedules, openTickets, criticalTickets, inventoryValue, paid, payable },
    provinceRows, lowStockRows,
    overdueSchedules: overdueScheduleRows.map((schedule) => ({
      id: schedule.id, title: schedule.title, dueDate: schedule.dueDate, status: schedule.status,
      machineId: schedule.machineId, machineName: schedule.machine.name || schedule.machine.model,
      customerName: schedule.machine.customer?.name || null, customerPhone: schedule.machine.customer?.phone || null,
    })),
    topDealers: topDealers.map((dealer) => ({ id: dealer.id, dealerCode: dealer.dealerCode, name: dealer.name, rating: dealer.rating, completed: dealer.serviceOrders.length, revenue: dealer.serviceOrders.reduce((s, o) => s + (o.serviceFee || 0), 0) })),
  } });
}
