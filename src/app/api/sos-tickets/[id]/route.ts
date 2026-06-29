import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const allowed = ["NEW", "PROCESSING", "ORDER_CREATED", "COMPLETED", "CANCELLED"];
  const status = typeof body.status === "string" ? body.status.toUpperCase() : "PROCESSING";
  if (!allowed.includes(status)) return NextResponse.json({ success: false, message: "Trạng thái không hợp lệ." }, { status: 400 });
  const ticket = await prisma.sosTicket.update({ where: { id }, data: { status } });
  return NextResponse.json({ success: true, message: "Đã cập nhật SOS.", data: ticket });
}
