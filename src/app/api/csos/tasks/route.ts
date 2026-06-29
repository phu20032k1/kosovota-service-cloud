import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
function startOfDay(value: Date) { const date = new Date(value); date.setHours(0,0,0,0); return date; }
function endOfDay(value: Date) { const date = new Date(value); date.setHours(23,59,59,999); return date; }
export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const now = new Date(); const todayStart = startOfDay(now); const todayEnd = endOfDay(now); const weekEnd = endOfDay(new Date(now.getTime() + 7 * 86400000));
  const scopes = auth.user.provinceScope?.split(",").map((value: string) => value.trim()).filter(Boolean) || [];
  const common = { status: "PENDING", ...(auth.user.role === "CSKH" && scopes.length ? { machine: { provinceCode: { in: scopes } } } : {}) };
  const [overdue, today, thisWeek, completedToday] = await Promise.all([
    prisma.maintenanceSchedule.findMany({ where: { ...common, dueDate: { lt: todayStart } }, include: { machine: { include: { customer: true } } }, orderBy: { dueDate: "asc" } }),
    prisma.maintenanceSchedule.findMany({ where: { ...common, dueDate: { gte: todayStart, lte: todayEnd } }, include: { machine: { include: { customer: true } } }, orderBy: { dueDate: "asc" } }),
    prisma.maintenanceSchedule.findMany({ where: { ...common, dueDate: { gt: todayEnd, lte: weekEnd } }, include: { machine: { include: { customer: true } } }, orderBy: { dueDate: "asc" } }),
    prisma.serviceOrder.count({ where: { status: "COMPLETED", updatedAt: { gte: todayStart, lte: todayEnd } } }),
  ]);
  return NextResponse.json({ success: true, summary: { overdue: overdue.length, today: today.length, thisWeek: thisWeek.length, completedToday }, data: { overdue, today, thisWeek } });
}
