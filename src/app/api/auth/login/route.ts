import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSessionToken } from "@/lib/session-token";
import { SESSION_COOKIE } from "@/lib/auth";
import { canRoleAccessPath, homeForRole, isInternalRole } from "@/lib/access-control";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(request, { namespace: "auth-login", limit: 12, windowMs: 10 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json({ success: false, message: "Đăng nhập quá nhiều lần. Vui lòng thử lại sau." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }
  try {
    const body = await request.json();
    const phone = normalizePhone(body.phone);
    const password = typeof body.password === "string" ? body.password : "";
    const requestedRole = typeof body.role === "string" ? body.role.trim().toUpperCase() : "";
    const requestedNext = typeof body.next === "string" ? body.next.trim() : "";

    if (!phone || !password) {
      return NextResponse.json({ success: false, message: "Vui lòng nhập số điện thoại và mật khẩu." }, { status: 400 });
    }
    if (!isInternalRole(requestedRole)) {
      return NextResponse.json({ success: false, message: "Vai trò đăng nhập không hợp lệ." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user?.active || !verifyPassword(password, user.password)) {
      return NextResponse.json({ success: false, message: "Sai số điện thoại hoặc mật khẩu." }, { status: 401 });
    }
    if (user.role !== requestedRole) {
      return NextResponse.json({ success: false, message: "Tài khoản không thuộc vai trò đã chọn. Hãy chọn đúng vị trí đăng nhập." }, { status: 403 });
    }
    if (!isInternalRole(user.role)) {
      return NextResponse.json({ success: false, message: "Tài khoản chưa được cấu hình đúng vai trò." }, { status: 403 });
    }

    if (!user.password.startsWith("scrypt$")) {
      await prisma.user.update({ where: { id: user.id }, data: { password: hashPassword(password) } });
    }

    const token = await createSessionToken({
      sub: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      dealerCode: user.dealerCode,
      provinceScope: user.provinceScope,
    });
    const redirect = requestedNext && canRoleAccessPath(user.role, requestedNext.split("?")[0])
      ? requestedNext
      : homeForRole(user.role);

    const response = NextResponse.json({
      success: true,
      user: { name: user.name, phone: user.phone, role: user.role, dealerCode: user.dealerCode },
      redirect,
    });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    await prisma.adminLog.create({ data: { userId: user.id, action: "LOGIN", target: user.role } });
    return response;
  } catch (error) {
    console.error("POST /api/auth/login failed", error);
    return NextResponse.json({ success: false, message: "Không thể đăng nhập lúc này." }, { status: 500 });
  }
}
