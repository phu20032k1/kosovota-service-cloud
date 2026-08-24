import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FINISHED_TICKET = ["RESOLVED", "CLOSED", "CANCELLED"];
const FINISHED_ORDER = ["COMPLETED", "CLOSED", "CANCELLED"];
const FINISHED_MAINTENANCE = ["COMPLETED", "CANCELLED"];

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) {
    return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  }

  const isAdmin = auth.user.role === "ADMIN";
  const now = new Date();
  const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [openTickets, activeOrders, dueMaintenance, dueCustomers, pendingDealers, pendingNotifications, pendingPayments, stockBalances] = await Promise.all([
    prisma.supportTicket.count({ where: { status: { notIn: FINISHED_TICKET } } }),
    prisma.serviceOrder.count({ where: { status: { notIn: FINISHED_ORDER } } }),
    prisma.maintenanceSchedule.count({
      where: {
        status: { notIn: FINISHED_MAINTENANCE },
        dueDate: { lte: nextSevenDays },
      },
    }),
    prisma.customer.count({ where: { nextContactAt: { lte: now } } }),
    isAdmin ? prisma.dealer.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    isAdmin ? prisma.notification.count({ where: { status: { in: ["PENDING", "FAILED"] } } }) : Promise.resolve(0),
    isAdmin ? prisma.paymentBatch.count({ where: { status: { in: ["SUBMITTED", "APPROVED"] } } }) : Promise.resolve(0),
    isAdmin
      ? prisma.stockBalance.findMany({
          select: { quantity: true, reserved: true, item: { select: { minStock: true } } },
        })
      : Promise.resolve([]),
  ]);

  const lowStock = stockBalances.filter((row) => row.quantity - row.reserved <= row.item.minStock).length;

  const counts: Record<string, number> = isAdmin
    ? {
        "/admin/customers": dueCustomers,
        "/admin/dealers": pendingDealers,
        "/admin/tickets": openTickets,
        "/admin/inventory": lowStock,
        "/admin/payments": pendingPayments,
        "/operations-map": activeOrders,
        "/maintenance-plans": dueMaintenance,
        "/admin/notifications": pendingNotifications,
      }
    : {
        "/csos": activeOrders,
        "/cskh/customers": dueCustomers,
        "/cskh/tickets": openTickets,
        "/operations-map": activeOrders,
        "/maintenance-plans": dueMaintenance,
      };

  return NextResponse.json({
    success: true,
    data: { counts, updatedAt: new Date().toISOString() },
  });
}
