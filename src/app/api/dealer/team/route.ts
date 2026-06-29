import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizePhone, isValidVietnamPhone } from "@/lib/phone";
import { hashPassword } from "@/lib/password";

function clean(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["DEALER"]);
  if (!auth?.user.dealerCode) return NextResponse.json({ success: false, message: "Tài khoản chưa liên kết đại lý." }, { status: 403 });
  const members = await prisma.user.findMany({
    where: { role: "KTV", dealerCode: auth.user.dealerCode },
    select: { id: true, name: true, phone: true, active: true, createdAt: true, _count: { select: { assignedServiceOrders: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ success: true, data: members });
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["DEALER"]);
  if (!auth?.user.dealerCode) return NextResponse.json({ success: false, message: "Tài khoản chưa liên kết đại lý." }, { status: 403 });
  try {
    const body = await request.json();
    const name = clean(body.name);
    const phone = normalizePhone(body.phone);
    if (!name || !isValidVietnamPhone(phone)) {
      return NextResponse.json({ success: false, message: "Vui lòng nhập họ tên và số điện thoại Việt Nam hợp lệ." }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) return NextResponse.json({ success: false, message: "Số điện thoại đã thuộc một tài khoản khác." }, { status: 409 });

    const initialPassword = `Ksv@${randomBytes(4).toString("hex")}`;
    const member = await prisma.user.create({
      data: { name, phone, password: hashPassword(initialPassword), role: "KTV", dealerCode: auth.user.dealerCode, active: true },
      select: { id: true, name: true, phone: true, active: true, createdAt: true },
    });
    await prisma.notification.create({
      data: { phone, channel: "SMS", kind: "KTV_ACCOUNT", content: `KOSOVOTA: Tài khoản KTV của bạn đã được tạo. SĐT: ${phone}. Mật khẩu ban đầu: ${initialPassword}.` },
    });
    await prisma.adminLog.create({ data: { userId: auth.user.id, action: "CREATE_KTV", target: member.id, detail: auth.user.dealerCode } });
    return NextResponse.json({ success: true, message: "Đã tạo KTV. Mật khẩu ban đầu đã được đưa vào hàng đợi SMS.", data: member, initialPassword }, { status: 201 });
  } catch (error) {
    console.error("POST /api/dealer/team failed", error);
    return NextResponse.json({ success: false, message: "Không tạo được tài khoản KTV." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await hasRole(request, ["DEALER"]);
  if (!auth?.user.dealerCode) return NextResponse.json({ success: false, message: "Tài khoản chưa liên kết đại lý." }, { status: 403 });
  try {
    const body = await request.json();
    const id = clean(body.id);
    const member = await prisma.user.findFirst({ where: { id, role: "KTV", dealerCode: auth.user.dealerCode } });
    if (!member) return NextResponse.json({ success: false, message: "Không tìm thấy KTV trong đại lý này." }, { status: 404 });

    if (body.action === "RESET_PASSWORD") {
      const password = `Ksv@${randomBytes(4).toString("hex")}`;
      await prisma.user.update({ where: { id }, data: { password: hashPassword(password) } });
      await prisma.notification.create({ data: { phone: member.phone, channel: "SMS", kind: "PASSWORD_RESET", content: `KOSOVOTA: Mật khẩu KTV mới của bạn là ${password}.` } });
      return NextResponse.json({ success: true, message: "Đã đặt lại mật khẩu và đưa SMS vào hàng đợi.", initialPassword: password });
    }

    if (typeof body.active !== "boolean") return NextResponse.json({ success: false, message: "Trạng thái không hợp lệ." }, { status: 400 });
    const updated = await prisma.user.update({ where: { id }, data: { active: body.active }, select: { id: true, name: true, phone: true, active: true } });
    return NextResponse.json({ success: true, message: body.active ? "Đã mở lại tài khoản KTV." : "Đã khóa tài khoản KTV.", data: updated });
  } catch (error) {
    console.error("PATCH /api/dealer/team failed", error);
    return NextResponse.json({ success: false, message: "Không cập nhật được KTV." }, { status: 500 });
  }
}
