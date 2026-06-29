import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được xem nhật ký." }, { status: 403 });
  const logs = await prisma.adminLog.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
  return NextResponse.json({ success: true, data: logs });
}
export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const body = await request.json();
  const action = typeof body.action === "string" ? body.action.trim() : "";
  if (!action) return NextResponse.json({ success: false, message: "Thiếu hành động nhật ký." }, { status: 400 });
  const log = await prisma.adminLog.create({ data: { userId: auth.user.id, action, target: typeof body.target === "string" ? body.target : null, detail: typeof body.detail === "string" ? body.detail : null } });
  return NextResponse.json({ success: true, data: log }, { status: 201 });
}
