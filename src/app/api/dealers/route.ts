import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { hashPassword } from "@/lib/password";
import { POST as registerDealer } from "@/app/api/dealers/register/route";

const DEALER_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"] as const;
type DealerStatus = (typeof DEALER_STATUSES)[number];
type DealerStatusResult = { dealerCode: string; phone: string; status: string; initialPassword: string | null };
type DealerStatusError = { dealerCode: string; message: string };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function statusErrorMessage(error: unknown, dealerCode: string) {
  const message = error instanceof Error ? error.message : "";
  if (message === "PHONE_ROLE_CONFLICT") return "Số điện thoại đang thuộc tài khoản vai trò khác.";
  if (message === "DEALER_NOT_FOUND") return `Không tìm thấy đại lý ${dealerCode}.`;
  return message && !message.startsWith("Prisma") ? message : "Không cập nhật được hồ sơ này.";
}

async function updateOneDealerStatus(
  dealerCode: string,
  status: DealerStatus,
  userId: string,
): Promise<DealerStatusResult> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.dealer.findUnique({ where: { dealerCode } });
    if (!current) throw new Error("DEALER_NOT_FOUND");

    const updated = await tx.dealer.update({ where: { dealerCode }, data: { status } });
    let initialPassword: string | null = null;

    if (status === "APPROVED") {
      const phone = normalizePhone(updated.phone);
      const existing = await tx.user.findUnique({ where: { phone } });
      const accountRole = /ctv|collaborator|cộng tác/i.test(updated.registrationType || "") ? "CTV" : "DEALER";
      if (existing && !["DEALER", "CTV"].includes(existing.role)) throw new Error("PHONE_ROLE_CONFLICT");

      if (!existing) {
        initialPassword = `Ksv@${randomBytes(4).toString("hex")}`;
        await tx.user.create({
          data: {
            phone,
            password: hashPassword(initialPassword),
            name: updated.representativeName || updated.name,
            role: accountRole,
            dealerCode: updated.dealerCode,
            active: true,
          },
        });
      } else {
        await tx.user.update({
          where: { id: existing.id },
          data: {
            role: accountRole,
            dealerCode: updated.dealerCode,
            active: true,
            name: updated.representativeName || updated.name,
          },
        });
      }
    } else if (status === "SUSPENDED" || status === "REJECTED") {
      await tx.user.updateMany({
        where: { dealerCode: updated.dealerCode, role: { in: ["DEALER", "CTV", "KTV"] } },
        data: { active: false },
      });
    }

    await tx.adminLog.create({
      data: {
        userId,
        action: "UPDATE_DEALER_STATUS",
        target: updated.dealerCode,
        detail: status,
      },
    });

    return { dealerCode: updated.dealerCode, phone: updated.phone, status: updated.status, initialPassword };
  });
}

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH", "DEALER", "CTV", "KTV"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  const where = ["DEALER", "CTV", "KTV"].includes(auth.user.role)
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
  return registerDealer(request);
}

export async function PATCH(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  try {
    const body = await request.json();
    const dealerCodes = dealerCodesFromBody(body);
    const status = text(body.status).toUpperCase();

    if (!dealerCodes.length || !isDealerStatus(status)) {
      return NextResponse.json({ success: false, message: "Dữ liệu cập nhật không hợp lệ." }, { status: 400 });
    }

    const results: DealerStatusResult[] = [];
    const errors: DealerStatusError[] = [];

    // Mỗi đại lý chạy trong transaction riêng. Một hồ sơ lỗi không rollback toàn bộ lô.
    for (const dealerCode of dealerCodes) {
      try {
        results.push(await updateOneDealerStatus(dealerCode, status, auth.user.id));
      } catch (error) {
        console.error(`PATCH /api/dealers failed for ${dealerCode}`, error);
        errors.push({ dealerCode, message: statusErrorMessage(error, dealerCode) });
      }
    }

    if (results.length) {
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
    }

    if (!results.length) {
      return NextResponse.json({
        success: false,
        message: dealerCodes.length === 1 ? errors[0]?.message || "Không cập nhật được đại lý." : `Không hồ sơ nào được cập nhật. Có ${errors.length} lỗi.`,
        summary: { successCount: 0, errorCount: errors.length },
        errors,
      }, { status: 409 });
    }

    const partial = errors.length > 0;
    return NextResponse.json({
      success: true,
      data: results,
      summary: { successCount: results.length, errorCount: errors.length },
      errors,
      message: partial
        ? `Đã cập nhật ${results.length}/${dealerCodes.length} hồ sơ. ${errors.length} hồ sơ lỗi được giữ nguyên để xử lý riêng.`
        : results.length === 1
          ? "Đã cập nhật hồ sơ đại lý."
          : `Đã cập nhật thành công toàn bộ ${results.length} hồ sơ đại lý.`,
    });
  } catch (error) {
    console.error("PATCH /api/dealers failed", error);
    return NextResponse.json({ success: false, message: "Không cập nhật được đại lý." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

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
        where: { dealerCode: { in: deletedCodes }, role: { in: ["DEALER", "CTV", "KTV"] } },
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
