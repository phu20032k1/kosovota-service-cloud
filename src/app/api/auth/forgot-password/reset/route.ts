import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { verifySessionToken } from "@/lib/session-token";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const token = typeof body.resetToken === "string" ? body.resetToken : "";

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: "Mật khẩu mới cần ít nhất 8 ký tự." },
        { status: 400 },
      );
    }

    const payload = await verifySessionToken(token);
    if (!payload || payload.purpose !== "RESET_PASSWORD" || payload.role !== "RESET") {
      return NextResponse.json({ success: false, message: "Phiên đặt lại mật khẩu không hợp lệ." }, { status: 401 });
    }

    await prisma.user.update({
      where: { phone: payload.phone },
      data: { password: hashPassword(newPassword) },
    });

    return NextResponse.json({ success: true, message: "Đã cập nhật mật khẩu mới." });
  } catch (error) {
    console.error("POST forgot-password/reset failed", error);
    return NextResponse.json({ success: false, message: "Không cập nhật được mật khẩu." }, { status: 500 });
  }
}
