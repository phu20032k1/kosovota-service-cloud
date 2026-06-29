import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { normalizePhone, isValidVietnamPhone } from "@/lib/phone";
import { hashPassword } from "@/lib/password";
import { formatSequence } from "@/lib/id-sequence";
import { provinceLetterCode } from "@/lib/province";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH", "DEALER", "KTV"]);
  if (!auth) {
    return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  }

  const where = ["DEALER", "KTV"].includes(auth.user.role)
    ? { dealerCode: auth.user.dealerCode || "__NONE__" }
    : undefined;

  const dealers = await prisma.dealer.findMany({
    where,
    include: { serviceOrders: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: dealers });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const extra = typeof body.extra === "object" && body.extra ? body.extra : {};
    const representativeName = text(body.representativeName || body.name);
    const companyName = text(extra.companyName || body.companyName);
    const phone = normalizePhone(body.phone);
    const province = text(body.province);
    const provinceCode = text(body.provinceCode) || provinceLetterCode(province);
    const registrationType = text(extra.registrationType || body.registrationType) || "DEALER";
    const requestedTypeCode = text(body.typeCode).toUpperCase();
    const registrationKey = registrationType.toUpperCase();
    const typeCode = requestedTypeCode === "CTV" || registrationKey.includes("CTV") || registrationKey.includes("COLLAB")
      ? "CTV"
      : "DL";
    const services = Array.isArray(body.services)
      ? body.services.map(text).filter(Boolean).join(", ")
      : text(body.services);

    if (!representativeName || !isValidVietnamPhone(phone) || !province || !services) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập đủ họ tên, số điện thoại hợp lệ, tỉnh và năng lực dịch vụ." },
        { status: 400 },
      );
    }

    if (!text(extra.citizenId || body.citizenId) || !text(extra.bankAccount || body.bankAccount)) {
      return NextResponse.json(
        { success: false, message: "CCCD và số tài khoản là thông tin bắt buộc." },
        { status: 400 },
      );
    }

    const year = String(new Date().getFullYear()).slice(-2);
    const sequenceKey = `DEALER:${provinceCode}:${typeCode}:${year}`;

    const dealer = await prisma.$transaction(async (tx) => {
      const sequence = await tx.idSequence.upsert({
        where: { key: sequenceKey },
        create: { key: sequenceKey, value: 1 },
        update: { value: { increment: 1 } },
      });
      const dealerCode = `${provinceCode}-${typeCode}-${year}-${formatSequence(sequence.value)}`;

      return tx.dealer.create({
        data: {
          dealerCode,
          name: companyName || representativeName,
          phone,
          province,
          address: text(body.address) || null,
          lat: numberOrNull(body.lat),
          lng: numberOrNull(body.lng),
          services,
          technicianCount: numberOrNull(body.technicianCount),
          status: "PENDING",
          representativeName,
          registrationType,
          companyName: companyName || null,
          birthDate: text(extra.birthDate || body.birthDate)
            ? new Date(text(extra.birthDate || body.birthDate))
            : null,
          locationType: text(extra.locationType || body.locationType) || null,
          serviceArea: text(extra.serviceArea || body.serviceArea) || null,
          taxCode: text(extra.taxCode || body.taxCode) || null,
          citizenId: text(extra.citizenId || body.citizenId),
          bankAccount: text(extra.bankAccount || body.bankAccount),
          accountHolder: text(extra.accountHolder || body.accountHolder) || null,
          bankName: text(extra.bankName || body.bankName) || null,
          portraitPhoto: text(extra.portraitPhoto || body.portraitPhoto) || null,
          storePhoto: text(extra.storePhoto || body.storePhoto) || null,
          warehousePhoto: text(extra.warehousePhoto || body.warehousePhoto) || null,
          videoName: text(extra.videoName || body.videoName) || null,
        },
      });
    });

    await prisma.notification.create({
      data: {
        phone,
        channel: "SMS",
        kind: "DEALER_REGISTRATION",
        content: `KOSOVOTA đã nhận đăng ký ${dealer.dealerCode}. Hồ sơ đang chờ duyệt.`,
      },
    });

    return NextResponse.json(
      { success: true, message: `Đăng ký thành công. Mã hồ sơ: ${dealer.dealerCode}.`, data: dealer },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/dealers failed", error);
    return NextResponse.json(
      { success: false, message: "Không tạo được hồ sơ đại lý. Số điện thoại hoặc mã hồ sơ có thể đã tồn tại." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) {
    return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const dealerCode = text(body.dealerCode);
    const status = text(body.status).toUpperCase();
    if (!dealerCode || !["PENDING", "APPROVED", "REJECTED", "SUSPENDED"].includes(status)) {
      return NextResponse.json({ success: false, message: "Dữ liệu cập nhật không hợp lệ." }, { status: 400 });
    }

    const current = await prisma.dealer.findUnique({ where: { dealerCode } });
    if (!current) {
      return NextResponse.json({ success: false, message: "Không tìm thấy đại lý." }, { status: 404 });
    }

    let initialPassword: string | null = null;
    const dealer = await prisma.$transaction(async (tx) => {
      const updated = await tx.dealer.update({ where: { dealerCode }, data: { status } });
      if (status === "APPROVED") {
        const phone = normalizePhone(updated.phone);
        const existing = await tx.user.findUnique({ where: { phone } });
        if (existing && existing.role !== "DEALER") {
          throw new Error("PHONE_ROLE_CONFLICT");
        }
        if (!existing) {
          initialPassword = `Ksv@${randomBytes(4).toString("hex")}`;
          await tx.user.create({
            data: {
              phone,
              password: hashPassword(initialPassword),
              name: updated.representativeName || updated.name,
              role: "DEALER",
              dealerCode: updated.dealerCode,
              active: true,
            },
          });
        } else {
          await tx.user.update({
            where: { id: existing.id },
            data: { dealerCode: updated.dealerCode, active: true, name: updated.representativeName || updated.name },
          });
        }
      } else if (status === "SUSPENDED" || status === "REJECTED") {
        await tx.user.updateMany({
          where: { dealerCode: updated.dealerCode, role: { in: ["DEALER", "KTV"] } },
          data: { active: false },
        });
      }
      return updated;
    });

    const content = status === "APPROVED"
      ? initialPassword
        ? `Hồ sơ ${dealerCode} đã được duyệt. Tài khoản: ${dealer.phone}. Mật khẩu ban đầu: ${initialPassword}. Hãy đổi mật khẩu bằng chức năng Quên mật khẩu.`
        : `Hồ sơ ${dealerCode} đã được duyệt. Tài khoản đại lý đã được kích hoạt.`
      : `Hồ sơ ${dealerCode} đã được cập nhật trạng thái ${status}.`;

    await prisma.notification.create({ data: { phone: dealer.phone, channel: "SMS", kind: "DEALER_STATUS", content } });
    await prisma.adminLog.create({
      data: { userId: auth.user.id, action: "UPDATE_DEALER_STATUS", target: dealerCode, detail: status },
    });

    return NextResponse.json({ success: true, data: dealer, message: "Đã cập nhật hồ sơ đại lý." });
  } catch (error) {
    console.error("PATCH /api/dealers failed", error);
    const conflict = error instanceof Error && error.message === "PHONE_ROLE_CONFLICT";
    return NextResponse.json(
      { success: false, message: conflict ? "Số điện thoại đang thuộc một tài khoản vai trò khác." : "Không cập nhật được đại lý." },
      { status: conflict ? 409 : 500 },
    );
  }
}
