import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const REPORT_ROLES = ["SUPER_ADMIN", "ADMIN", "CSKH", "SALES_MANAGER", "DIRECTOR", "DEALER", "CTV", "KTV"];
const BUG_ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"];
function parseDetail(value: string | null) { try { return value ? JSON.parse(value) : {}; } catch { return {}; } }

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, REPORT_ROLES);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa đăng nhập." }, { status: 401 });
  try {
    const body = await request.json();
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const action = typeof body.action === "string" ? body.action.trim() : "";
    const expected = typeof body.expected === "string" ? body.expected.trim() : "";
    const actual = typeof body.actual === "string" ? body.actual.trim() : "";
    const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl.slice(0, 1000) : "";
    const screenshot = typeof body.screenshot === "string" ? body.screenshot : "";
    if (!category || !action || !expected || !actual) return NextResponse.json({ success: false, message: "Hãy ghi đủ: đã bấm gì, mong đợi gì và thực tế thấy gì." }, { status: 400 });
    const id = randomUUID();
    const detail = JSON.stringify({ category, action, expected, actual, pageUrl, screenshot, status: "NEW", reporterName: auth.user.name, reporterRole: auth.user.role, reporterPhone: auth.user.phone });
    await prisma.adminLog.create({ data: { userId: auth.user.id, action: "BUG_REPORT", target: id, detail } });
    return NextResponse.json({ success: true, message: "Đã gửi báo lỗi. Quản trị có thể theo dõi ngay.", id }, { status: 201 });
  } catch (error) {
    console.error("bug report create failed", error);
    return NextResponse.json({ success: false, message: "Không gửi được báo lỗi." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, BUG_ADMIN_ROLES);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Quản trị được xem báo lỗi." }, { status: 403 });
  const [reports, statuses] = await Promise.all([
    prisma.adminLog.findMany({ where: { action: "BUG_REPORT" }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.adminLog.findMany({ where: { action: "BUG_REPORT_STATUS" }, orderBy: { createdAt: "asc" }, take: 1000 }),
  ]);
  const statusMap = new Map(statuses.map((item) => [item.target || "", parseDetail(item.detail).status || "NEW"]));
  return NextResponse.json({ success: true, data: reports.map((item) => ({ id: item.target || item.id, createdAt: item.createdAt, userId: item.userId, ...parseDetail(item.detail), status: statusMap.get(item.target || "") || parseDetail(item.detail).status || "NEW" })) });
}

export async function PATCH(request: NextRequest) {
  const auth = await hasRole(request, BUG_ADMIN_ROLES);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Quản trị được cập nhật báo lỗi." }, { status: 403 });
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
    if (!id || !["NEW", "FIXING", "FIXED"].includes(status)) return NextResponse.json({ success: false, message: "Trạng thái không hợp lệ." }, { status: 400 });
    const exists = await prisma.adminLog.findFirst({ where: { action: "BUG_REPORT", target: id }, select: { id: true } });
    if (!exists) return NextResponse.json({ success: false, message: "Không tìm thấy báo lỗi." }, { status: 404 });
    await prisma.adminLog.create({ data: { userId: auth.user.id, action: "BUG_REPORT_STATUS", target: id, detail: JSON.stringify({ status }) } });
    return NextResponse.json({ success: true, message: "Đã cập nhật trạng thái." });
  } catch (error) {
    console.error("bug report status failed", error);
    return NextResponse.json({ success: false, message: "Không cập nhật được trạng thái." }, { status: 500 });
  }
}
