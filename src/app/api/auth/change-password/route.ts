import { NextRequest, NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { homeForRole } from "@/lib/access-control";

export async function POST(request: NextRequest) {
  const auth = await getActiveUser(request);
  if (!auth) return NextResponse.json({ success: false, message: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  try {
    const body = await request.json();
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
    if (!verifyPassword(currentPassword, auth.user.password)) return NextResponse.json({ success: false, message: "Mật khẩu hiện tại không đúng." }, { status: 400 });
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) return NextResponse.json({ success: false, message: "Mật khẩu mới cần ít nhất 8 ký tự, có chữ và số." }, { status: 400 });
    if (newPassword !== confirmPassword) return NextResponse.json({ success: false, message: "Hai lần nhập mật khẩu mới chưa giống nhau." }, { status: 400 });
    if (verifyPassword(newPassword, auth.user.password)) return NextResponse.json({ success: false, message: "Mật khẩu mới phải khác mật khẩu hiện tại." }, { status: 400 });

    await prisma.$transaction([
      prisma.user.update({ where: { id: auth.user.id }, data: { password: hashPassword(newPassword) } }),
      prisma.adminLog.create({ data: { userId: auth.user.id, action: "PASSWORD_CHANGED", target: auth.user.id } }),
    ]);
    return NextResponse.json({ success: true, message: "Đã đổi mật khẩu.", redirect: homeForRole(auth.user.role) });
  } catch (error) {
    console.error("change password failed", error);
    return NextResponse.json({ success: false, message: "Không đổi được mật khẩu lúc này." }, { status: 500 });
  }
}
