import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 403 });
  const [machines, dealers, orders, reports, sosTickets] = await Promise.all([prisma.machine.findMany(), prisma.dealer.findMany(), prisma.serviceOrder.findMany(), prisma.serviceReport.findMany(), prisma.sosTicket.findMany()]);
  return NextResponse.json({ success: true, data: { stats: { machines: machines.length, dealers: dealers.length, orders: orders.length, reports: reports.length, sos: sosTickets.length, completedOrders: orders.filter((o: { status: string }) => o.status === "COMPLETED").length, pendingOrders: orders.filter((o: { status: string }) => !["COMPLETED", "CANCELLED"].includes(o.status)).length }, machines, dealers, orders, reports, sosTickets } });
}
