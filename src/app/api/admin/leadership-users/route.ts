import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { normalizePhone, isValidVietnamPhone } from "@/lib/phone";
import { writeAudit } from "@/lib/audit";

const ROLES = new Set(["SALES_MANAGER", "DIRECTOR"]);
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được quản lý tài khoản lãnh đạo." }, { status: 403 });
  const users = await prisma.user.findMany({ where: { role: { in: ["SALES_MANAGER", "DIRECTOR"] } }, select: { id: true, name: true, phone: true, email: true, role: true, active: true, createdAt: true }, orderBy: [{ role: "asc" }, { name: "asc" }] });
  return NextResponse.json({ success: true, data: users });
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được tạo tài khoản lãnh đạo." }, { status: 403 });
  try {
    const body = await request.json();
    const role = clean(body.role).toUpperCase();
    const name = clean(body.name);
    const phone = normalizePhone(body.phone);
    const email = clean(body.email).toLowerCase();
    if (!ROLES.has(role)) return NextResponse.json({ success: false, message: "Vai trò chỉ có thể là Trưởng phòng Kinh doanh hoặc Giám đốc." }, { status: 400 });
    if (!name || !isValidVietnamPhone(phone)) return NextResponse.json({ success: false, message: "Hãy nhập họ tên và số điện thoại Việt Nam hợp lệ." }, { status: 400 });
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ success: false, message: "Email không hợp lệ." }, { status: 400 });
    if (await prisma.user.findUnique({ where: { phone } })) return NextResponse.json({ success: false, message: "Số điện thoại đã có tài khoản." }, { status: 409 });

    const initialPassword = `Ksv@${randomBytes(4).toString("hex")}`;
    const user = await prisma.user.create({ data: { name, phone, email: email || null, role, password: hashPassword(initialPassword), active: true }, select: { id: true, name: true, phone: true, email: true, role: true, active: true, createdAt: true } });
    await prisma.adminLog.create({ data: { userId: user.id, action: "FORCE_PASSWORD_CHANGE", target: user.id, detail: "ADMIN_CREATED_LEADERSHIP_ACCOUNT" } });
    await writeAudit({ request, userId: auth.user.id, action: "ADMIN_CREATE_LEADERSHIP_USER", target: user.id, detail: { role, phone } });
    return NextResponse.json({ success: true, message: "Đã tạo tài khoản. Người dùng phải đổi mật khẩu ở lần đăng nhập đầu.", data: user, initialPassword }, { status: 201 });
  } catch (error) {
    console.error("create leadership user failed", error);
    return NextResponse.json({ success: false, message: "Không tạo được tài khoản." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được cập nhật tài khoản lãnh đạo." }, { status: 403 });
  try {
    const body = await request.json();
    const id = clean(body.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !ROLES.has(user.role)) return NextResponse.json({ success: false, message: "Không tìm thấy tài khoản." }, { status: 404 });

    if (body.action === "RESET_PASSWORD") {
      const password = `Ksv@${randomBytes(4).toString("hex")}`;
      await prisma.$transaction([
        prisma.user.update({ where: { id }, data: { password: hashPassword(password) } }),
        prisma.adminLog.create({ data: { userId: id, action: "FORCE_PASSWORD_CHANGE", target: id, detail: "ADMIN_RESET_PASSWORD" } }),
      ]);
      await writeAudit({ request, userId: auth.user.id, action: "ADMIN_RESET_LEADERSHIP_PASSWORD", target: id });
      return NextResponse.json({ success: true, message: "Đã đặt lại mật khẩu. Người dùng phải đổi mật khẩu ở lần đăng nhập tiếp theo.", initialPassword: password });
    }

    if (typeof body.active !== "boolean") return NextResponse.json({ success: false, message: "Trạng thái không hợp lệ." }, { status: 400 });
    const updated = await prisma.user.update({ where: { id }, data: { active: body.active }, select: { id: true, name: true, phone: true, email: true, role: true, active: true, createdAt: true } });
    await writeAudit({ request, userId: auth.user.id, action: body.active ? "ADMIN_UNLOCK_LEADERSHIP_USER" : "ADMIN_LOCK_LEADERSHIP_USER", target: id });
    return NextResponse.json({ success: true, message: body.active ? "Đã mở lại tài khoản." : "Đã khóa tài khoản.", data: updated });
  } catch (error) {
    console.error("update leadership user failed", error);
    return NextResponse.json({ success: false, message: "Không cập nhật được tài khoản." }, { status: 500 });
  }
}
