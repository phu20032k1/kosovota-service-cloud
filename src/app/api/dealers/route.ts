import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { normalizePhone, isValidVietnamPhone } from "@/lib/phone";
import { hashPassword } from "@/lib/password";
import { formatSequence } from "@/lib/id-sequence";
import { provinceLetterCode } from "@/lib/province";

const DEALER_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"] as const;
type DealerStatus = (typeof DEALER_STATUSES)[number];

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function uniqueStrings(values: unknown[]) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function dealerCodesFromBody(body: Record<string, unknown>) {
  if (Array.isArray(body.dealerCodes)) return uniqueStrings(body.dealerCodes);
  if (Array.isArray(body.codes)) return uniqueStrings(body.codes);
  if (Array.isArray(body.ids)) return uniqueStrings(body.ids);
  return uniqueStrings([body.dealerCode, body.code, body.id]);
}

function isDealerStatus(value: string): value is DealerStatus {
  return (DEALER_STATUSES as readonly string[]).includes(value);
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
    const dealerCodes = dealerCodesFromBody(body);
    const status = text(body.status).toUpperCase();

    if (!dealerCodes.length || !isDealerStatus(status)) {
      return NextResponse.json({ success: false, message: "Dữ liệu cập nhật không hợp lệ." }, { status: 400 });
    }

    const results = await prisma.$transaction(async (tx) => {
      const updatedDealers: Array<{ dealerCode: string; phone: string; status: string; initialPassword: string | null }> = [];

      for (const dealerCode of dealerCodes) {
        const current = await tx.dealer.findUnique({ where: { dealerCode } });
        if (!current) {
          throw new Error(`DEALER_NOT_FOUND:${dealerCode}`);
        }

        const updated = await tx.dealer.update({ where: { dealerCode }, data: { status } });
        let initialPassword: string | null = null;

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

        updatedDealers.push({ dealerCode: updated.dealerCode, phone: updated.phone, status: updated.status, initialPassword });
      }

      await tx.adminLog.createMany({
        data: updatedDealers.map((dealer) => ({
          userId: auth.user.id,
          action: "UPDATE_DEALER_STATUS",
          target: dealer.dealerCode,
          detail: status,
        })),
      });

      return updatedDealers;
    });

    await prisma.notification.createMany({
      data: results.map((dealer) => ({
        phone: dealer.phone,
        channel: "SMS",
        kind: "DEALER_STATUS",
        content: status === "APPROVED"
          ? dealer.initialPassword
            ? `Hồ sơ ${dealer.dealerCode} đã được duyệt. Tài khoản: ${dealer.phone}. Mật khẩu ban đầu: ${dealer.initialPassword}. Hãy đổi mật khẩu bằng chức năng Quên mật khẩu.`
            : `Hồ sơ ${dealer.dealerCode} đã được duyệt. Tài khoản đại lý đã được kích hoạt.`
          : `Hồ sơ ${dealer.dealerCode} đã được cập nhật trạng thái ${status}.`,
      })),
    });

    return NextResponse.json({
      success: true,
      data: results,
      message: results.length === 1
        ? "Đã cập nhật hồ sơ đại lý."
        : `Đã cập nhật ${results.length} hồ sơ đại lý.`,
    });
  } catch (error) {
    console.error("PATCH /api/dealers failed", error);
    const message = error instanceof Error ? error.message : "";
    const conflict = message === "PHONE_ROLE_CONFLICT";
    const notFound = message.startsWith("DEALER_NOT_FOUND:");
    return NextResponse.json(
      {
        success: false,
        message: conflict
          ? "Số điện thoại đang thuộc một tài khoản vai trò khác."
          : notFound
            ? `Không tìm thấy đại lý ${message.split(":")[1]}.`
            : "Không cập nhật được đại lý.",
      },
      { status: conflict ? 409 : notFound ? 404 : 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) {
    return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const dealerCodes = dealerCodesFromBody(body);

    if (!dealerCodes.length) {
      return NextResponse.json({ success: false, message: "Vui lòng chọn đại lý cần xóa." }, { status: 400 });
    }

    const dealers = await prisma.dealer.findMany({
      where: { dealerCode: { in: dealerCodes } },
      select: { id: true, dealerCode: true, name: true },
    });

    if (!dealers.length) {
      return NextResponse.json({ success: false, message: "Không tìm thấy đại lý cần xóa." }, { status: 404 });
    }

    const deletedCodes = dealers.map((dealer) => dealer.dealerCode);
    const dealerIds = dealers.map((dealer) => dealer.id);

    await prisma.$transaction(async (tx) => {
      const batches = await tx.paymentBatch.findMany({
        where: { dealerId: { in: dealerIds } },
        select: { id: true },
      });
      const batchIds = batches.map((batch) => batch.id);
      if (batchIds.length) {
        await tx.paymentLine.deleteMany({ where: { batchId: { in: batchIds } } });
        await tx.paymentBatch.deleteMany({ where: { id: { in: batchIds } } });
      }

      const warehouses = await tx.warehouse.findMany({
        where: { dealerId: { in: dealerIds } },
        select: { id: true },
      });
      const warehouseIds = warehouses.map((warehouse) => warehouse.id);
      if (warehouseIds.length) {
        await tx.stockMovement.updateMany({
          where: { fromWarehouseId: { in: warehouseIds } },
          data: { fromWarehouseId: null },
        });
        await tx.stockMovement.updateMany({
          where: { toWarehouseId: { in: warehouseIds } },
          data: { toWarehouseId: null },
        });
        await tx.stockBalance.deleteMany({ where: { warehouseId: { in: warehouseIds } } });
        await tx.warehouse.deleteMany({ where: { id: { in: warehouseIds } } });
      }

      await tx.serviceOrder.updateMany({ where: { dealerId: { in: dealerIds } }, data: { dealerId: null } });
      await tx.supportTicket.updateMany({ where: { dealerId: { in: dealerIds } }, data: { dealerId: null } });
      await tx.user.updateMany({
        where: { dealerCode: { in: deletedCodes }, role: { in: ["DEALER", "KTV"] } },
        data: { active: false, dealerCode: null },
      });
      await tx.dealer.deleteMany({ where: { id: { in: dealerIds } } });
      await tx.adminLog.createMany({
        data: deletedCodes.map((dealerCode) => ({
          userId: auth.user.id,
          action: "DELETE_DEALER",
          target: dealerCode,
          detail: "Xóa hồ sơ đại lý; giữ lịch sử dịch vụ bằng cách bỏ liên kết dealerId.",
        })),
      });
    });

    return NextResponse.json({
      success: true,
      data: { deletedCodes },
      message: deletedCodes.length === 1 ? "Đã xóa đại lý." : `Đã xóa ${deletedCodes.length} đại lý.`,
    });
  } catch (error) {
    console.error("DELETE /api/dealers failed", error);
    return NextResponse.json({ success: false, message: "Không xóa được đại lý." }, { status: 500 });
  }
}
