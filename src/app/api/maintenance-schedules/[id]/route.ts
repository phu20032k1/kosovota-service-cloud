import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const allowed = ["PENDING", "ORDER_CREATED", "COMPLETED", "DISABLED", "SELF_SERVICE"];
  if (!allowed.includes(body.status)) return NextResponse.json({ success: false, message: "Trạng thái không hợp lệ." }, { status: 400 });
  const schedule = await prisma.maintenanceSchedule.update({ where: { id }, data: { status: body.status } });
  return NextResponse.json({ success: true, data: schedule });
}
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được xóa lịch." }, { status: 403 });
  const { id } = await params;
  await prisma.maintenanceSchedule.delete({ where: { id } });
  return NextResponse.json({ success: true, message: "Đã xóa lịch bảo trì." });
}
