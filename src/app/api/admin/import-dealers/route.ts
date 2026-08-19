import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { readSheet } from "read-excel-file/node";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { normalizePhone, isValidVietnamPhone } from "@/lib/phone";
import { hashPassword } from "@/lib/password";
import { geocodeAddress } from "@/lib/maps/geocode";
import { bumpDealerCacheVersion } from "@/lib/redis";

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

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

async function readRows(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (/\.csv$/i.test(file.name)) return spreadsheetRows(parseCsv(buffer.toString("utf8").replace(/^\uFEFF/, "")));
  return spreadsheetRows(await readSheet(buffer));
}

function value(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const found = row[key] ?? row[normalizedHeader(key)];
    if (found !== undefined && found !== null && String(found).trim() !== "") return String(found).trim();
  }
  return "";
}

function numberOrNull(text: string) {
  const raw = text.trim();
  if (!raw) return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function integerCount(text: string) {
  const value = numberOrNull(text);
  return value === null ? null : Math.max(0, Math.round(value));
}

function hasUsableCoordinates(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return !(Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001);
}

function dateOrNull(input: unknown) {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === "number") return new Date(Date.UTC(1899, 11, 30) + input * 86400000);
  const text = String(input).trim();
  if (!text) return null;
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const parsed = match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function registrationType(row: Record<string, unknown>) {
  const source = value(row, "Loại đăng ký", "Loại", "Vai trò", "Registration Type", "registrationType");
  if (!source) return "";
  const raw = normalizedHeader(source);
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
    if (!(file instanceof File)) return NextResponse.json({ success: false, message: "Chưa chọn file dữ liệu." }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ success: false, message: "File tối đa 15 MB." }, { status: 413 });
    if (!/\.(xlsx|xlsm|csv)$/i.test(file.name)) return NextResponse.json({ success: false, message: "Chỉ hỗ trợ file .xlsx, .xlsm hoặc .csv." }, { status: 415 });

    const parsedRows = await readRows(file);
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
    let gpsUpdatedCount = 0;
    let technicianUpdatedCount = 0;
    const errors: { row: number; message: string }[] = [];

    for (const { data: row, rowNumber } of parsedRows) {
      try {
        const dealerCode = value(row, "Mã đại lý", "Ma dai ly", "Dealer Code", "dealerCode", "Mã khách hàng CRM", "Mã CRM", "CRM Code").toUpperCase();
        const name = value(row, "Tên đại lý", "Ten dai ly", "Tên", "Name", "Công ty", "Company", "Tên công ty");
        const representativeName = value(row, "Đại diện", "Người đại diện", "Nguoi dai dien", "Representative", "Họ tên", "Ho ten");
        const phone = normalizePhone(value(row, "SĐT", "Số điện thoại", "Phone", "Điện thoại"));
        const province = value(row, "Tỉnh", "Province", "Tỉnh/Thành", "Tinh thanh");
        const type = registrationType(row);
        const address = value(row, "Địa chỉ", "Address");
        const services = value(row, "Dịch vụ", "Năng lực dịch vụ", "Services");
        const technicianCount = integerCount(value(
          row,
          "Số KTV",
          "Số kỹ thuật viên",
          "Số kỹ thuật viên hiện có",
          "Kỹ thuật viên",
          "Technician Count",
        ));
        const serviceArea = value(row, "Khu vực phụ trách", "Service Area");
        const companyName = value(row, "Tên công ty", "Company");
        const email = value(row, "Email");
        const birthDate = dateOrNull(row["Ngày sinh"] ?? row[normalizedHeader("Ngày sinh")] ?? row["Birth date"] ?? row[normalizedHeader("Birth date")]);
        const locationType = value(row, "Loại địa điểm", "Location Type");
        const taxCode = value(row, "Mã số thuế", "Tax Code");
        const citizenId = value(row, "CCCD", "Citizen ID");
        const bankAccount = value(row, "Số tài khoản", "Bank Account");
        const accountHolder = value(row, "Chủ tài khoản", "Account Holder");
        const bankName = value(row, "Ngân hàng", "Bank Name");
        const portraitPhoto = value(row, "Ảnh chân dung", "Portrait Photo");
        const storePhoto = value(row, "Ảnh cửa hàng", "Store Photo");
        const warehousePhoto = value(row, "Ảnh kho", "Warehouse Photo");
        const videoName = value(row, "Video", "Tên video", "Video Name");
        const inputLat = numberOrNull(value(row, "Vĩ độ", "Latitude", "lat"));
        const inputLng = numberOrNull(value(row, "Kinh độ", "Longitude", "lng"));

        if (!dealerCode) throw new Error("Thiếu Mã đại lý/Mã CRM; hệ thống không tự sinh mã");
        if (!/^[A-Z0-9][A-Z0-9._/-]{2,39}$/.test(dealerCode)) throw new Error("Mã CRM không hợp lệ");
        if (!name) throw new Error("Thiếu tên đại lý");
        if (!isValidVietnamPhone(phone)) throw new Error(`SĐT không hợp lệ: ${phone || "trống"}`);

        const existed = await prisma.dealer.findUnique({
          where: { dealerCode },
          select: { id: true, address: true, lat: true, lng: true },
        });
        const addressChanged = Boolean(address) && address !== (existed?.address || "").trim();
        let lat: number | null | undefined;
        let lng: number | null | undefined;
        let coordinatesShouldChange = false;
        let gpsAutoFilled = false;

        if (hasUsableCoordinates(inputLat, inputLng)) {
          lat = inputLat;
          lng = inputLng;
          coordinatesShouldChange = true;
        } else if (address && (!existed || addressChanged || !hasUsableCoordinates(existed.lat, existed.lng))) {
          coordinatesShouldChange = true;
          lat = null;
          lng = null;
          if (process.env.GEOCODING_ENABLED === "true") {
            try {
              const location = await geocodeAddress(address);
              if (location && hasUsableCoordinates(location.lat, location.lng)) {
                lat = location.lat;
                lng = location.lng;
                gpsAutoFilled = true;
              }
            } catch (geocodeError) {
              console.warn(`Không tự lấy được GPS dòng ${rowNumber} (${dealerCode}):`, geocodeError);
            }
          }
        }

        const result = await prisma.$transaction(async (tx) => {
          const dealer = await tx.dealer.upsert({
            where: { dealerCode },
            update: {
              name,
              phone,
              status: "APPROVED",
              ...(representativeName ? { representativeName } : {}),
              ...(type ? { registrationType: type } : {}),
              ...(province ? { province } : {}),
              ...(address ? { address } : {}),
              ...(services ? { services } : {}),
              ...(technicianCount !== null ? { technicianCount } : {}),
              ...(serviceArea ? { serviceArea } : {}),
              ...(companyName ? { companyName } : {}),
              ...(email ? { email } : {}),
              ...(birthDate ? { birthDate } : {}),
              ...(locationType ? { locationType } : {}),
              ...(taxCode ? { taxCode } : {}),
              ...(citizenId ? { citizenId } : {}),
              ...(bankAccount ? { bankAccount } : {}),
              ...(accountHolder ? { accountHolder } : {}),
              ...(bankName ? { bankName } : {}),
              ...(portraitPhoto ? { portraitPhoto } : {}),
              ...(storePhoto ? { storePhoto } : {}),
              ...(warehousePhoto ? { warehousePhoto } : {}),
              ...(videoName ? { videoName } : {}),
              ...(coordinatesShouldChange ? { lat: lat ?? null, lng: lng ?? null } : {}),
            },
            create: {
              dealerCode,
              name,
              representativeName: representativeName || name,
              phone,
              registrationType: type || "dealer",
              province: province || null,
              address: address || null,
              services: services || "Lắp đặt, bảo trì",
              status: "APPROVED",
              technicianCount,
              serviceArea: serviceArea || null,
              companyName: companyName || null,
              email: email || null,
              birthDate,
              locationType: locationType || null,
              taxCode: taxCode || null,
              citizenId: citizenId || null,
              bankAccount: bankAccount || null,
              accountHolder: accountHolder || null,
              bankName: bankName || null,
              portraitPhoto: portraitPhoto || null,
              storePhoto: storePhoto || null,
              warehousePhoto: warehousePhoto || null,
              videoName: videoName || null,
              lat: coordinatesShouldChange ? lat ?? null : null,
              lng: coordinatesShouldChange ? lng ?? null : null,
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
        if (gpsAutoFilled) gpsUpdatedCount += 1;
        if (technicianCount !== null) technicianUpdatedCount += 1;
      } catch (error) {
        errors.push({ row: rowNumber, message: error instanceof Error ? error.message : "Dữ liệu không hợp lệ" });
      }
    }

    await prisma.adminLog.create({
      data: {
        userId: auth.user.id,
        action: "IMPORT_DEALERS_AUTO_APPROVED",
        target: file.name,
        detail: `Tự động duyệt ${successCount}; tạo ${createdCount}; cập nhật ${updatedCount}; KTV ${technicianUpdatedCount}; GPS ${gpsUpdatedCount}; lỗi ${errors.length}`,
      },
    });
    if (successCount > 0) await bumpDealerCacheVersion();

    return NextResponse.json({
      success: true,
      message: errors.length
        ? `Đã xử lý ${successCount} hồ sơ; có ${errors.length} dòng lỗi cần kiểm tra.`
        : `Đã import và tự động duyệt ${successCount} hồ sơ đại lý/CTV.`,
      summary: {
        successCount,
        errorCount: errors.length,
        createdCount,
        updatedCount,
        accountCreatedCount,
        gpsUpdatedCount,
        technicianUpdatedCount,
      },
      errors,
    });
  } catch (error) {
    console.error("import dealers failed", error);
    return NextResponse.json({ success: false, message: "Không đọc được file đại lý." }, { status: 500 });
  }
}
