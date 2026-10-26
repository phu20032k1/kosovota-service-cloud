import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readMaterialSale } from "@/lib/material-sale";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["SALES_MANAGER"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Trưởng phòng Kinh doanh được truy cập." }, { status: 403 });
  try {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
    const in60 = new Date(now); in60.setDate(in60.getDate() + 60);
    const in90 = new Date(now); in90.setDate(in90.getDate() + 90);
    const [tickets, pendingPartners, dealers, provinceMachines, due30, due60, due90, salesUsers] = await Promise.all([
      prisma.supportTicket.findMany({ where: { type: "MATERIAL_SALE" }, include: { customer: true, machine: true, assignee: { select: { id: true, name: true } }, messages: { orderBy: { createdAt: "desc" }, take: 10 } }, orderBy: { updatedAt: "desc" }, take: 200 }),
      prisma.dealer.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 100 }),
      prisma.dealer.findMany({ where: { status: "APPROVED" }, include: { serviceOrders: { where: { status: "COMPLETED" }, select: { serviceFee: true, updatedAt: true } } }, orderBy: { name: "asc" } }),
      prisma.machine.groupBy({ by: ["provinceCode"], _count: { _all: true } }),
      prisma.maintenanceSchedule.count({ where: { dueDate: { gte: now, lte: in30 }, status: { not: "COMPLETED" } } }),
      prisma.maintenanceSchedule.count({ where: { dueDate: { gt: in30, lte: in60 }, status: { not: "COMPLETED" } } }),
      prisma.maintenanceSchedule.count({ where: { dueDate: { gt: in60, lte: in90 }, status: { not: "COMPLETED" } } }),
      prisma.user.findMany({ where: { active: true, role: { in: ["SALES_MANAGER", "CSKH"] } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    ]);

    const opportunities = tickets.map((ticket) => {
      const material = readMaterialSale(ticket.description).order;
      const soldMessage = ticket.messages.find((message) => message.message.startsWith("SALE_SOLD|"));
      const soldValue = soldMessage ? Number(soldMessage.message.split("|")[1] || 0) : material.total;
      return { id: ticket.id, ticketCode: ticket.ticketCode, customerName: ticket.customer?.name || ticket.contactName || "Khách hàng", customerPhone: ticket.customer?.phone || ticket.contactPhone || "", machineId: ticket.machineId, provinceCode: ticket.machine?.provinceCode || null, status: ticket.status, assignee: ticket.assignee, total: Number.isFinite(soldValue) ? soldValue : 0, updatedAt: ticket.updatedAt };
    });
    const soldThisMonth = opportunities.filter((item) => item.status === "RESOLVED" && new Date(item.updatedAt) >= startMonth);
    const soldValueMonth = soldThisMonth.reduce((sum, item) => sum + item.total, 0);
    const dealerPerformance = dealers.map((dealer) => ({ id: dealer.id, dealerCode: dealer.dealerCode, name: dealer.name, province: dealer.province, completed: dealer.serviceOrders.length, value: dealer.serviceOrders.reduce((sum, order) => sum + (order.serviceFee || 0), 0) })).sort((a,b)=>b.completed-a.completed);
    const dealerByProvince = new Map<string, number>();
    for (const dealer of dealers) if (dealer.province) dealerByProvince.set(dealer.province, (dealerByProvince.get(dealer.province) || 0) + 1);
    const recruitingRegions = provinceMachines.filter((row) => row.provinceCode && !dealerByProvince.get(row.provinceCode)).map((row) => ({ province: row.provinceCode!, machines: row._count._all }));

    return NextResponse.json({ success: true, data: { kpis: { open: opportunities.filter((item)=>!["RESOLVED","CANCELLED"].includes(item.status)).length, soldMonth: soldThisMonth.length, soldValueMonth, pendingPartners: pendingPartners.length }, demand: { days30: due30, days60: due60, days90: due90 }, opportunities, dealerPerformance, recruitingRegions, pendingPartners, salesUsers } });
  } catch (error) {
    console.error("sales manager dashboard failed", error);
    return NextResponse.json({ success: false, message: "Không tải được báo cáo kinh doanh." }, { status: 500 });
  }
}
