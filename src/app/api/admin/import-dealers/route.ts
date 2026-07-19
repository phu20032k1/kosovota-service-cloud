import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { readSheet } from "read-excel-file/node";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { normalizePhone, isValidVietnamPhone } from "@/lib/phone";
import { hashPassword } from "@/lib/password";

function normalizedHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase()
    .replace(/[._/-]+/g, " ")
    .replace(/\s+/g, " ");
}

function spreadsheetRows(cells: unknown[][]) {
  const headerIndex = cells.findIndex((row) => {
    const headings = row.map(normalizedHeader);
    const hasDealerCode = headings.some((h) => ["ma dai ly", "dealer code", "dealercode", "ma khach hang crm", "ma crm", "crm code"].includes(h));
    const hasPhone = headings.some((h) => ["sdt", "so dien thoai", "phone", "dien thoai"].includes(h));
    const hasName = headings.some((h) => ["ten dai ly", "ten", "name", "dai ly", "cong ty", "ten cong ty"].includes(h));
    return hasDealerCode && hasPhone && hasName;
  });
  if (headerIndex < 0) return null;

  const headers = cells[headerIndex].map((cell) => String(cell ?? "").trim());
  const rows: { data: Record<string, unknown>; rowNumber: number }[] = [];
  cells.slice(headerIndex + 1).forEach((cellsInRow, dataIndex) => {
    const record: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const cell = cellsInRow[index] ?? "";
      record[header] = cell;
      record[normalizedHeader(header)] = cell;
      if (cell !== null && cell !== undefined && String(cell).trim() !== "") hasValue = true;
    });
    if (hasValue) rows.push({ data: record, rowNumber: headerIndex + dataIndex + 2 });
  });
  return rows;
}

function value(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const found = row[key] ?? row[normalizedHeader(key)];
    if (found !== undefined && found !== null && String(found).trim() !== "") return String(found).trim();
  }
  return "";
}

function numberOrNull(text: string) {
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function registrationType(row: Record<string, unknown>) {
  const raw = normalizedHeader(value(row, "Loại đăng ký", "Loại", "Vai trò", "Registration Type", "registrationType"));
  return raw.includes("ctv") || raw.includes("cong tac") || raw.includes("collaborator") ? "collaborator" : "dealer";
}

async function ensureApprovedAccount(
  tx: Prisma.TransactionClient,
  dealer: { dealerCode: string; phone: string; name: string; representativeName?: string | null; registrationType?: string | null },
) {
  const phone = normalizePhone(dealer.phone);
  const role = /ctv|collaborator|cộng tác/i.test(dealer.registrationType || "") ? "CTV" : "DEALER";
  const existing = await tx.user.findUnique({ where: { phone } });
  if (existing && !["DEALER", "CTV"].includes(existing.role)) throw new Error("SĐT đang thuộc tài khoản vai trò khác");
  if (existing) {
    await tx.user.update({
      where: { id: existing.id },
      data: { role, dealerCode: dealer.dealerCode, name: dealer.representativeName || dealer.name, active: true },
    });
    return null;
  }

  const initialPassword = `Ksv@${randomBytes(4).toString("hex")}`;
  await tx.user.create({
    data: {
      phone,
      password: hashPassword(initialPassword),
      name: dealer.representativeName || dealer.name,
      role,
      dealerCode: dealer.dealerCode,
      active: true,
    },
  });
  return initialPassword;
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được import đại lý." }, { status: 403 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ success: false, message: "Chưa chọn file Excel." }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ success: false, message: "File Excel tối đa 15 MB." }, { status: 413 });
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) return NextResponse.json({ success: false, message: "Chỉ hỗ trợ file .xlsx hoặc .xlsm." }, { status: 415 });

    const cells = await readSheet(Buffer.from(await file.arrayBuffer()));
    const parsedRows = spreadsheetRows(cells);
    if (!parsedRows) {
      return NextResponse.json({
        success: false,
        message: "Không tìm thấy tiêu đề hợp lệ. File bắt buộc có Mã đại lý/Mã CRM, Tên đại lý và Số điện thoại.",
      }, { status: 422 });
    }
    if (parsedRows.length > 10_000) return NextResponse.json({ success: false, message: "Mỗi lần import tối đa 10.000 dòng." }, { status: 413 });

    let successCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let accountCreatedCount = 0;
    const errors: { row: number; message: string }[] = [];

    for (const { data: row, rowNumber } of parsedRows) {
      try {
        const dealerCode = value(row, "Mã đại lý", "Ma dai ly", "Dealer Code", "dealerCode", "Mã khách hàng CRM", "Mã CRM", "CRM Code").toUpperCase();
        const name = value(row, "Tên đại lý", "Ten dai ly", "Tên", "Name", "Công ty", "Company", "Tên công ty");
        const representativeName = value(row, "Đại diện", "Người đại diện", "Nguoi dai dien", "Representative", "Họ tên", "Ho ten") || name;
        const phone = normalizePhone(value(row, "SĐT", "Số điện thoại", "Phone", "Điện thoại"));
        const province = value(row, "Tỉnh", "Province", "Tỉnh/Thành", "Tinh thanh");
        const type = registrationType(row);

        if (!dealerCode) throw new Error("Thiếu Mã đại lý/Mã CRM; hệ thống không tự sinh mã");
        if (!/^[A-Z0-9][A-Z0-9._/-]{2,39}$/.test(dealerCode)) throw new Error("Mã CRM không hợp lệ");
        if (!name) throw new Error("Thiếu tên đại lý");
        if (!isValidVietnamPhone(phone)) throw new Error("SĐT không hợp lệ");

        const existed = await prisma.dealer.findUnique({ where: { dealerCode }, select: { id: true } });
        const result = await prisma.$transaction(async (tx) => {
          const dealer = await tx.dealer.upsert({
            where: { dealerCode },
            update: {
              name,
              representativeName,
              phone,
              registrationType: type,
              province: province || undefined,
              address: value(row, "Địa chỉ", "Address") || undefined,
              services: value(row, "Dịch vụ", "Năng lực dịch vụ", "Services") || "Lắp đặt, bảo trì",
              status: "APPROVED",
              technicianCount: numberOrNull(value(row, "Số KTV", "Technician Count")) ?? undefined,
              serviceArea: value(row, "Khu vực phụ trách", "Service Area") || undefined,
              companyName: value(row, "Tên công ty", "Company") || undefined,
              taxCode: value(row, "Mã số thuế", "Tax Code") || undefined,
              citizenId: value(row, "CCCD", "Citizen ID") || undefined,
              bankAccount: value(row, "Số tài khoản", "Bank Account") || undefined,
              accountHolder: value(row, "Chủ tài khoản", "Account Holder") || undefined,
              bankName: value(row, "Ngân hàng", "Bank Name") || undefined,
              lat: numberOrNull(value(row, "Vĩ độ", "Latitude", "lat")),
              lng: numberOrNull(value(row, "Kinh độ", "Longitude", "lng")),
            },
            create: {
              dealerCode,
              name,
              representativeName,
              phone,
              registrationType: type,
              province: province || null,
              address: value(row, "Địa chỉ", "Address") || null,
              services: value(row, "Dịch vụ", "Năng lực dịch vụ", "Services") || "Lắp đặt, bảo trì",
              status: "APPROVED",
              technicianCount: numberOrNull(value(row, "Số KTV", "Technician Count")),
              serviceArea: value(row, "Khu vực phụ trách", "Service Area") || null,
              companyName: value(row, "Tên công ty", "Company") || null,
              taxCode: value(row, "Mã số thuế", "Tax Code") || null,
              citizenId: value(row, "CCCD", "Citizen ID") || null,
              bankAccount: value(row, "Số tài khoản", "Bank Account") || null,
              accountHolder: value(row, "Chủ tài khoản", "Account Holder") || null,
              bankName: value(row, "Ngân hàng", "Bank Name") || null,
              lat: numberOrNull(value(row, "Vĩ độ", "Latitude", "lat")),
              lng: numberOrNull(value(row, "Kinh độ", "Longitude", "lng")),
            },
          });
          const initialPassword = await ensureApprovedAccount(tx, dealer);
          if (initialPassword) {
            await tx.notification.create({
              data: {
                phone: dealer.phone,
                channel: "SMS",
                kind: "DEALER_IMPORT_ACCOUNT",
                content: `Hồ sơ ${dealerCode} đã được tự động duyệt. Tài khoản: ${dealer.phone}. Mật khẩu ban đầu: ${initialPassword}`,
              },
            });
          }
          return { initialPassword };
        });

        successCount += 1;
        if (existed) updatedCount += 1; else createdCount += 1;
        if (result.initialPassword) accountCreatedCount += 1;
      } catch (error) {
        errors.push({ row: rowNumber, message: error instanceof Error ? error.message : "Dữ liệu không hợp lệ" });
      }
    }

    await prisma.adminLog.create({
      data: {
        userId: auth.user.id,
        action: "IMPORT_DEALERS_AUTO_APPROVED",
        target: file.name,
        detail: `Tự động duyệt ${successCount}; tạo ${createdCount}; cập nhật ${updatedCount}; lỗi ${errors.length}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã import và tự động duyệt ${successCount} hồ sơ đại lý/CTV.`,
      summary: { successCount, errorCount: errors.length, createdCount, updatedCount, accountCreatedCount },
      errors,
    });
  } catch (error) {
    console.error("import dealers failed", error);
    return NextResponse.json({ success: false, message: "Không đọc được file Excel." }, { status: 500 });
  }
}
