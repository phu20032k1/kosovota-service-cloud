import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được truy cập báo cáo." }, { status: 403 });
  try {
    const [machines, dealers, orders, reports, sosTickets, leads, notifications] = await Promise.all([
      prisma.machine.findMany({ include: { customer: true, maintenanceSchedules: { orderBy: { dueDate: "asc" } } }, orderBy: { createdAt: "desc" } }),
      prisma.dealer.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.serviceOrder.findMany({ include: { dealer: true, machine: true }, orderBy: { createdAt: "desc" } }),
      prisma.serviceReport.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.sosTicket.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.salesLead.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
      prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    return NextResponse.json({ success: true, data: { machines, dealers, orders, reports, sosTickets, leads, notifications } });
  } catch (error) {
    console.error("GET admin reports failed", error);
    return NextResponse.json({ success: false, message: "Không tải được báo cáo quản trị." }, { status: 500 });
  }
}
