import { NextRequest, NextResponse } from "next/server";
import { consumeOtp } from "@/lib/otp";
import { createSessionToken } from "@/lib/session-token";
import { normalizePhone } from "@/lib/phone";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const phone = normalizePhone(body.phone);
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  const result = await consumeOtp(phone, "RESET_PASSWORD", otp);

  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.message }, { status: 400 });
  }

  const resetToken = await createSessionToken(
    {
      sub: phone,
      phone,
      name: "Password reset",
      role: "RESET",
      purpose: "RESET_PASSWORD",
    },
    10 * 60,
  );

  return NextResponse.json({ success: true, resetToken });
}
