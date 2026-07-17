import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { queueNotification } from "@/lib/notifications/enqueue";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được xem hàng đợi thông báo." }, { status: 403 });
  const notifications = await prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  const safeNotifications = notifications.map((item: { kind?: string | null; content: string; payload?: string | null; [key: string]: unknown }) => ({
    ...item,
    payload: undefined,
    content: item.kind === "OTP" ? "Nội dung OTP đã được ẩn để bảo mật." : item.content,
  }));
  return NextResponse.json({ success: true, data: safeNotifications });
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const body = await request.json();
  const channel = typeof body.channel === "string" ? body.channel.toUpperCase() : "ZALO";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : undefined;
  const email = typeof body.email === "string" ? body.email.trim() : undefined;
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;

  if (!content) return NextResponse.json({ success: false, message: "Thiếu nội dung." }, { status: 400 });
  if (channel === "EMAIL" && !email) return NextResponse.json({ success: false, message: "Thiếu email người nhận." }, { status: 400 });
  if ((channel === "SMS" || channel === "ZALO") && !phone) return NextResponse.json({ success: false, message: "Thiếu số điện thoại người nhận." }, { status: 400 });

  const notification = await queueNotification({
    channel,
    phone,
    email,
    subject,
    content,
    kind: typeof body.kind === "string" ? body.kind : undefined,
    recipientName: typeof body.recipientName === "string" ? body.recipientName : undefined,
    payload: typeof body.payload === "object" ? body.payload : undefined,
  });
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
