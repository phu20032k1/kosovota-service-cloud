import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được xem hàng đợi thông báo." }, { status: 403 });
  const notifications = await prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  const safeNotifications = notifications.map((item: { kind?: string | null; content: string; [key: string]: unknown }) => ({ ...item, payload: undefined, content: item.kind === "OTP" ? "Nội dung OTP đã được ẩn để bảo mật." : item.content }));
  return NextResponse.json({ success: true, data: safeNotifications });
}
export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const body = await request.json();
  const phone = normalizePhone(body.phone);
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!phone || !content) return NextResponse.json({ success: false, message: "Thiếu người nhận hoặc nội dung." }, { status: 400 });
  const notification = await prisma.notification.create({ data: { phone, channel: typeof body.channel === "string" ? body.channel : "ZALO", content, status: "PENDING" } });
  return NextResponse.json({ success: true, message: "Thông báo đã được đưa vào hàng đợi.", data: notification }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được thao tác." }, { status: 403 });
  const body = await request.json();
  if (typeof body.id !== "string") return NextResponse.json({ success: false, message: "Thiếu ID thông báo." }, { status: 400 });
  const notification = await prisma.notification.update({ where: { id: body.id }, data: { status: "PENDING", attempts: 0, error: null, providerMessageId: null, sentAt: null } });
  return NextResponse.json({ success: true, message: "Đã đưa thông báo trở lại hàng đợi.", data: notification });
}
