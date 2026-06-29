import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueOtp } from "@/lib/otp";
import { isValidVietnamPhone, normalizePhone } from "@/lib/phone";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const phone = normalizePhone(body.phone);
  const ipRate = checkRateLimit(request, { namespace: "customer-otp-ip", limit: 8, windowMs: 10 * 60 * 1000 });
  const phoneRate = checkRateLimit(request, { namespace: "customer-otp-phone", identifier: phone, limit: 4, windowMs: 10 * 60 * 1000 });
  if (!ipRate.allowed || !phoneRate.allowed) {
    const retryAfter = Math.max(ipRate.retryAfterSeconds, phoneRate.retryAfterSeconds);
    return NextResponse.json({ success: false, message: "Yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }

  if (!isValidVietnamPhone(phone)) {
    return NextResponse.json({ success: false, message: "Số điện thoại chưa hợp lệ." }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { phone } });
  const sharedMachine = await prisma.machine.findFirst({
    where: { sharedPhones: { contains: phone } },
    select: { id: true },
  });

  if (!customer && !sharedMachine) {
    return NextResponse.json({ success: false, message: "Số điện thoại chưa gắn với máy KOSOVOTA." }, { status: 404 });
  }

  const otp = await issueOtp({
    phone,
    purpose: "CUSTOMER_LOGIN",
    message: (code) => `KOSOVOTA: Mã OTP đăng nhập cổng khách hàng là ${code}. Mã có hiệu lực 5 phút.`,
  });

  return NextResponse.json({
    success: true,
    message: "Mã OTP đã được gửi.",
    expiresAt: otp.expiresAt,
    ...(otp.debugCode ? { debugCode: otp.debugCode } : {}),
  });
}
