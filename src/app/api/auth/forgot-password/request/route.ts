import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidVietnamPhone, normalizePhone } from "@/lib/phone";
import { issueOtp } from "@/lib/otp";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const phone = normalizePhone(body.phone);
    const ipRate = checkRateLimit(request, { namespace: "forgot-password-ip", limit: 8, windowMs: 10 * 60 * 1000 });
    const phoneRate = checkRateLimit(request, { namespace: "forgot-password-phone", identifier: phone, limit: 4, windowMs: 10 * 60 * 1000 });
    if (!ipRate.allowed || !phoneRate.allowed) {
      const retryAfter = Math.max(ipRate.retryAfterSeconds, phoneRate.retryAfterSeconds);
      return NextResponse.json({ success: false, message: "Yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
    }

    if (!isValidVietnamPhone(phone)) {
      return NextResponse.json({ success: false, message: "Số điện thoại chưa hợp lệ." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || user.role === "SUPER_ADMIN") {
      return NextResponse.json({
        success: true,
        message: "Nếu số điện thoại đủ điều kiện, mã OTP sẽ được gửi ngay.",
      });
    }

    const otp = await issueOtp({
      phone,
      purpose: "RESET_PASSWORD",
      message: (code) => `KOSOVOTA: Mã OTP đặt lại mật khẩu của bạn là ${code}. Mã có hiệu lực 5 phút.`,
    });

    return NextResponse.json({
      success: true,
      message: "Mã OTP đã được gửi qua kênh thông báo đã đăng ký.",
      expiresAt: otp.expiresAt,
      ...(otp.debugCode ? { debugCode: otp.debugCode } : {}),
    });
  } catch (error) {
    console.error("POST forgot-password/request failed", error);
    return NextResponse.json({ success: false, message: "Không gửi được mã OTP." }, { status: 500 });
  }
}
