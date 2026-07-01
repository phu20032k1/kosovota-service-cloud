import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { normalizePhone, isValidVietnamPhone } from "@/lib/phone";
import { readSheet } from "read-excel-file/node";
import { hashPassword } from "@/lib/password";
import { nextSequence, formatSequence } from "@/lib/id-sequence";
import { provinceLetterCode } from "@/lib/province";

function normalizedHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function spreadsheetRows(cells: unknown[][]) {
  const headerIndex = cells.findIndex((row) => {
    const headings = row.map(normalizedHeader);
    const hasDealer = headings.some((h) => ["ma dai ly", "dealer code", "dealercode", "ma", "code"].includes(h));
    const hasPhone = headings.some((h) => ["sdt", "so dien thoai", "phone", "dien thoai"].includes(h));
    const hasName = headings.some((h) => ["ten dai ly", "ten", "name", "dai ly", "cong ty"].includes(h));
    return hasPhone && (hasDealer || hasName);
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
    const exact = row[key];
    const normalized = row[normalizedHeader(key)];
    const found = exact ?? normalized;
    if (found !== undefined && found !== null && String(found).trim() !== "") return String(found).trim();
  }
  return "";
}

function numberOrNull(text: string) {
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function safeStatus(text: string) {
  const status = text.trim().toUpperCase();
  return ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"].includes(status) ? status : "PENDING";
}

function dealerTypeCode(text: string) {
  const normalized = normalizedHeader(text);
  if (normalized.includes("cong tac") || normalized.includes("ctv")) return "CTV";
  if (normalized.includes("ky thuat") || normalized.includes("ktv")) return "KTV";
  return "DL";
}

async function buildDealerCode(row: Record<string, unknown>, province: string) {
  const explicit = value(row, "Mã đại lý", "Ma dai ly", "Dealer Code", "dealerCode", "Mã", "Code").toUpperCase();
  if (explicit) return explicit;
  const provinceCode = provinceLetterCode(province || value(row, "Tỉnh", "Province", "Tỉnh/Thành", "Tinh thanh"));
  const typeCode = dealerTypeCode(value(row, "Loại", "Loại đại lý", "Registration Type", "registrationType", "Dịch vụ", "Services"));
  const year = new Date().getFullYear().toString().slice(-2);
  const sequenceKey = `DEALER_IMPORT:${provinceCode}:${typeCode}:${year}`;
  const sequence = await nextSequence(sequenceKey);
  return `${provinceCode}-${typeCode}-${year}-${formatSequence(sequence)}`;
}

async function ensureApprovedDealerUser(tx: Prisma.TransactionClient, dealer: { dealerCode: string; phone: string; name: string; representativeName?: string | null }) {
  const phone = normalizePhone(dealer.phone);
  const existing = await tx.user.findUnique({ where: { phone } });
  if (existing && existing.role !== "DEALER") throw new Error("SĐT đang thuộc tài khoản vai trò khác");
  if (existing) {
    await tx.user.update({
      where: { id: existing.id },
      data: { dealerCode: dealer.dealerCode, name: dealer.representativeName || dealer.name, active: true },
    });
    return null;
  }
  const initialPassword = `Ksv@${randomBytes(4).toString("hex")}`;
  await tx.user.create({
    data: {
      phone,
      password: hashPassword(initialPassword),
      name: dealer.representativeName || dealer.name,
      role: "DEALER",
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
      return NextResponse.json({ success: false, message: "Không tìm thấy cột hợp lệ. File cần có SĐT và Tên đại lý hoặc Mã đại lý." }, { status: 422 });
    }
    if (parsedRows.length > 10_000) return NextResponse.json({ success: false, message: "Mỗi lần import tối đa 10.000 dòng." }, { status: 413 });

    let successCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let accountCreatedCount = 0;
    const errors: { row: number; message: string }[] = [];

    for (const { data: row, rowNumber } of parsedRows) {
      try {
        const name = value(row, "Tên đại lý", "Ten dai ly", "Tên", "Name", "Công ty", "Company");
        const representativeName = value(row, "Đại diện", "Nguời đại diện", "Nguoi dai dien", "Representative", "Họ tên", "Ho ten") || name;
        const phone = normalizePhone(value(row, "SĐT", "Số điện thoại", "Phone", "Điện thoại"));
        const province = value(row, "Tỉnh", "Province", "Tỉnh/Thành", "Tinh thanh");
        const address = value(row, "Địa chỉ", "Address");
        const services = value(row, "Dịch vụ", "Năng lực dịch vụ", "Services") || "Lắp đặt, bảo trì";
        const status = safeStatus(value(row, "Trạng thái", "Status"));
        const dealerCode = await buildDealerCode(row, province);

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
              province: province || undefined,
              address: address || undefined,
              services,
              status,
              technicianCount: numberOrNull(value(row, "Số KTV", "Technician Count")) ?? undefined,
              serviceArea: value(row, "Khu vực phụ trách", "Service Area") || undefined,
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
              province: province || null,
              address: address || null,
              services,
              status,
              technicianCount: numberOrNull(value(row, "Số KTV", "Technician Count")),
              serviceArea: value(row, "Khu vực phụ trách", "Service Area") || null,
              taxCode: value(row, "Mã số thuế", "Tax Code") || null,
              citizenId: value(row, "CCCD", "Citizen ID") || null,
              bankAccount: value(row, "Số tài khoản", "Bank Account") || null,
              accountHolder: value(row, "Chủ tài khoản", "Account Holder") || null,
              bankName: value(row, "Ngân hàng", "Bank Name") || null,
              lat: numberOrNull(value(row, "Vĩ độ", "Latitude", "lat")),
              lng: numberOrNull(value(row, "Kinh độ", "Longitude", "lng")),
            },
          });
          const initialPassword = status === "APPROVED" ? await ensureApprovedDealerUser(tx, dealer) : null;
          if (["REJECTED", "SUSPENDED"].includes(status)) {
            await tx.user.updateMany({ where: { dealerCode, role: { in: ["DEALER", "KTV"] } }, data: { active: false } });
          }
          if (initialPassword) {
            await tx.notification.create({ data: { phone: dealer.phone, channel: "SMS", kind: "DEALER_IMPORT_ACCOUNT", content: `Tài khoản đại lý ${dealerCode}: ${dealer.phone}. Mật khẩu ban đầu: ${initialPassword}` } });
          }
          return { initialPassword };
        });

        successCount += 1;
        if (result.initialPassword) accountCreatedCount += 1;
        if (existed) updatedCount += 1; else createdCount += 1;
      } catch (error) {
        errors.push({ row: rowNumber, message: error instanceof Error ? error.message : "Dữ liệu không hợp lệ" });
      }
    }

    await prisma.adminLog.create({ data: { userId: auth.user.id, action: "IMPORT_DEALERS", target: file.name, detail: `Tạo mới ${createdCount}, cập nhật ${updatedCount}, tạo tài khoản ${accountCreatedCount}, lỗi ${errors.length}` } });
    return NextResponse.json({ success: true, message: "Đã xử lý file Excel đại lý.", summary: { successCount, errorCount: errors.length, createdCount, updatedCount, accountCreatedCount }, errors });
  } catch (error) {
    console.error("import dealers failed", error);
    return NextResponse.json({ success: false, message: "Không đọc được file Excel đại lý." }, { status: 500 });
  }
}
