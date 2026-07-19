import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { normalizePhone, isValidVietnamPhone } from "@/lib/phone";

const CREATABLE_ROLES = new Set(["ADMIN", "CSKH", "DEALER", "CTV", "KTV"]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeUser(user: { id: string; phone: string; name: string; role: string; dealerCode: string | null; provinceScope: string | null; active: boolean; createdAt: Date; updatedAt: Date }) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    dealerCode: user.dealerCode,
    provinceScope: user.provinceScope,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function validateDealer(role: string, dealerCode: string) {
  if (!["DEALER", "CTV", "KTV"].includes(role)) return null;
  if (!dealerCode) throw new Error("ROLE_NEEDS_DEALER");
  if (["CTV", "KTV"].includes(role)) {
    const dealer = await prisma.dealer.findUnique({ where: { dealerCode } });
    if (!dealer || dealer.status !== "APPROVED") throw new Error("DEALER_NOT_FOUND");
    return dealer;
  }
  return prisma.dealer.findUnique({ where: { dealerCode } });
}

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["SUPER_ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ SUPER_ADMIN được vào khu này." }, { status: 403 });

  const [users, dealers] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "CSKH", "DEALER", "CTV", "KTV"] } },
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    }),
    prisma.dealer.findMany({
      where: { status: "APPROVED" },
      orderBy: { dealerCode: "asc" },
      select: { dealerCode: true, name: true, phone: true, province: true },
    }),
  ]);

  return NextResponse.json({ success: true, data: { users: users.map(safeUser), dealers } });
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["SUPER_ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ SUPER_ADMIN được tạo tài khoản cấp dưới." }, { status: 403 });

  const body = await request.json();
  const role = text(body.role).toUpperCase();
  const phone = normalizePhone(text(body.phone));
  const name = text(body.name);
  const provinceScope = text(body.provinceScope) || null;
  const dealerCode = text(body.dealerCode).toUpperCase() || null;
  const dealerProvince = text(body.dealerProvince) || null;

  if (!CREATABLE_ROLES.has(role)) {
    return NextResponse.json({ success: false, message: "Vai trò không hợp lệ." }, { status: 400 });
  }
  if (!name || !isValidVietnamPhone(phone)) {
    return NextResponse.json({ success: false, message: "Vui lòng nhập họ tên và số điện thoại Việt Nam hợp lệ." }, { status: 400 });
  }
  if (role === "CSKH" && !provinceScope) {
    return NextResponse.json({ success: false, message: "CSKH cần provinceScope, ví dụ 01 hoặc 01,33." }, { status: 400 });
  }

  try {
    const dealer = await validateDealer(role, dealerCode || "");
    if (role === "DEALER" && dealer && dealer.status !== "APPROVED") {
      return NextResponse.json({ success: false, message: "Mã đại lý đã tồn tại nhưng chưa được duyệt." }, { status: 409 });
    }
    if (dealerCode) {
      const linkedDealerUser = await prisma.user.findFirst({ where: { role: "DEALER", dealerCode } });
      if (role === "DEALER" && linkedDealerUser) {
        return NextResponse.json({ success: false, message: "Mã đại lý này đã có tài khoản Đại lý." }, { status: 409 });
      }
    }

    const initialPassword = text(body.password) || `Ksv@${randomBytes(4).toString("hex")}`;
    if (initialPassword.length < 10) {
      return NextResponse.json({ success: false, message: "Mật khẩu cần ít nhất 10 ký tự." }, { status: 400 });
    }

    const user = await prisma.$transaction(async (tx) => {
      if (role === "DEALER" && dealerCode && !dealer) {
        await tx.dealer.create({
          data: {
            dealerCode,
            name,
            phone,
            province: dealerProvince,
            representativeName: name,
            status: "APPROVED",
          },
        });
      }
      const created = await tx.user.create({
        data: {
          phone,
          name,
          role,
          dealerCode: ["DEALER", "CTV", "KTV"].includes(role) ? dealerCode : null,
          provinceScope: role === "CSKH" ? provinceScope : null,
          password: hashPassword(initialPassword),
          active: true,
        },
      });
      await tx.notification.create({
        data: {
          phone,
          channel: "SMS",
          kind: `${role}_ACCOUNT`,
          content: `KOSOVOTA: Tài khoản ${role} đã được tạo. SĐT: ${phone}. Mật khẩu ban đầu: ${initialPassword}.`,
        },
      });
      await tx.adminLog.create({ data: { userId: auth.user.id, action: "SUPER_CREATE_USER", target: created.id, detail: `${role}:${phone}:${dealerCode || ""}` } });
      return created;
    });

    return NextResponse.json({ success: true, data: safeUser(user), initialPassword }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ROLE_NEEDS_DEALER") {
      return NextResponse.json({ success: false, message: "Đại lý/CTV/KTV bắt buộc phải có mã đại lý." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "DEALER_NOT_FOUND") {
      return NextResponse.json({ success: false, message: "Không tìm thấy đại lý đã duyệt cho KTV." }, { status: 404 });
    }
    console.error("POST /api/super-admin/users failed", error);
    return NextResponse.json({ success: false, message: "Không tạo được tài khoản. Số điện thoại hoặc mã đại lý có thể đã tồn tại." }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await hasRole(request, ["SUPER_ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ SUPER_ADMIN được sửa tài khoản cấp dưới." }, { status: 403 });

  const body = await request.json();
  const id = text(body.id);
  if (!id) return NextResponse.json({ success: false, message: "Thiếu ID tài khoản." }, { status: 400 });

  const current = await prisma.user.findUnique({ where: { id } });
  if (!current || current.role === "SUPER_ADMIN") {
    return NextResponse.json({ success: false, message: "Không tìm thấy tài khoản cấp dưới hoặc không được sửa SUPER_ADMIN tại đây." }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.active === "boolean") data.active = body.active;
  if ("name" in body) {
    const name = text(body.name);
    if (!name) return NextResponse.json({ success: false, message: "Tên không được để trống." }, { status: 400 });
    data.name = name;
  }
  if ("phone" in body) {
    const phone = normalizePhone(text(body.phone));
    if (!isValidVietnamPhone(phone)) return NextResponse.json({ success: false, message: "Số điện thoại phải là số Việt Nam hợp lệ." }, { status: 400 });
    data.phone = phone;
  }
  if (current.role === "CSKH" && "provinceScope" in body) data.provinceScope = text(body.provinceScope) || null;
  if (["DEALER", "CTV", "KTV"].includes(current.role) && "dealerCode" in body) {
    const dealerCode = text(body.dealerCode).toUpperCase();
    const dealer = await prisma.dealer.findUnique({ where: { dealerCode } });
    if (!dealer || dealer.status !== "APPROVED") return NextResponse.json({ success: false, message: "Mã đại lý không tồn tại hoặc chưa duyệt." }, { status: 400 });
    data.dealerCode = dealerCode;
  }

  let initialPassword: string | null = null;
  if (body.resetPassword === true) {
    initialPassword = `Ksv@${randomBytes(4).toString("hex")}`;
    data.password = hashPassword(initialPassword);
  } else if (typeof body.resetPassword === "string" && body.resetPassword.length > 0) {
    if (body.resetPassword.length < 10) return NextResponse.json({ success: false, message: "Mật khẩu mới phải có ít nhất 10 ký tự." }, { status: 400 });
    data.password = hashPassword(body.resetPassword);
  }

  try {
    const updated = await prisma.user.update({ where: { id }, data });
    await prisma.adminLog.create({ data: { userId: auth.user.id, action: "SUPER_UPDATE_USER", target: id, detail: JSON.stringify(Object.keys(data)) } });
    return NextResponse.json({ success: true, data: safeUser(updated), ...(initialPassword ? { initialPassword } : {}) });
  } catch (error) {
    console.error("PATCH /api/super-admin/users failed", error);
    return NextResponse.json({ success: false, message: "Không cập nhật được tài khoản. Số điện thoại có thể đã tồn tại." }, { status: 409 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await hasRole(request, ["SUPER_ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ SUPER_ADMIN được xóa tài khoản cấp dưới." }, { status: 403 });

  const body = await request.json();
  const id = text(body.id);
  if (!id) return NextResponse.json({ success: false, message: "Thiếu ID tài khoản." }, { status: 400 });

  const current = await prisma.user.findUnique({ where: { id } });
  if (!current || current.role === "SUPER_ADMIN") return NextResponse.json({ success: false, message: "Không tìm thấy tài khoản cấp dưới hoặc không được xóa SUPER_ADMIN." }, { status: 404 });

  try {
    await prisma.user.delete({ where: { id } });
    await prisma.adminLog.create({ data: { userId: auth.user.id, action: "SUPER_DELETE_USER", target: id, detail: `${current.role}:${current.phone}` } });
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("DELETE /api/super-admin/users failed", error);
    return NextResponse.json({ success: false, message: "Tài khoản đang liên kết dữ liệu. Hãy dùng nút Khóa thay vì Xóa." }, { status: 409 });
  }
}
