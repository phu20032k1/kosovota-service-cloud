import { NextRequest, NextResponse } from "next/server";
import { consumeOtp } from "@/lib/otp";
import { createSessionToken } from "@/lib/session-token";
import { normalizePhone } from "@/lib/phone";
import { CUSTOMER_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const phone = normalizePhone(body.phone);
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  const result = await consumeOtp(phone, "CUSTOMER_LOGIN", otp);

  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.message }, { status: 400 });
  }

  const token = await createSessionToken(
    { sub: phone, phone, name: "Customer", role: "CUSTOMER_PORTAL", purpose: "CUSTOMER_LOGIN" },
    60 * 60 * 24 * 7,
  );

  const response = NextResponse.json({ success: true });
  response.cookies.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
