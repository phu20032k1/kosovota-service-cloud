import { NextRequest, NextResponse } from "next/server";
import { readSheet } from "read-excel-file/node";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidVietnamPhone, normalizePhone } from "@/lib/phone";

function normalizedHeader(input: unknown) {
  return String(input ?? "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase()
    .replace(/[()[\]{}:;,+|\\._/*#?-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NAME_HEADERS = ["ten khach hang", "ten kh", "khach hang", "ho ten", "ho va ten", "customer name", "ten", "name"];
const PHONE_HEADERS = ["sdt", "so dt", "so dien thoai", "so dien thoai kh", "dien thoai", "dien thoai di dong", "phone", "phone number", "mobile", "mobile phone"];
const SERIAL_HEADERS = ["id may", "ma may", "so seri", "so serial", "seri", "serial"];

function rowsFromSheet(cells: unknown[][]) {
  const headerIndex = cells.findIndex((row) => {
    const headers = row.map(normalizedHeader);
    return headers.some((header) => NAME_HEADERS.includes(header)) && headers.some((header) => PHONE_HEADERS.includes(header));
  });
  if (headerIndex < 0) return null;
  const headers = cells[headerIndex].map(normalizedHeader);
  return cells.slice(headerIndex + 1).flatMap((row, index) => {
    if (!row.some((cell) => String(cell ?? "").trim())) return [];
    const data: Record<string, unknown> = {};
    headers.forEach((header, cellIndex) => { if (header) data[header] = row[cellIndex] ?? ""; });
    return [{ data, rowNumber: headerIndex + index + 2 }];
  });
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
  if (/\.csv$/i.test(file.name)) return rowsFromSheet(parseCsv(buffer.toString("utf8").replace(/^\uFEFF/, "")));
  return rowsFromSheet(await readSheet(buffer));
}

function value(row: Record<string, unknown>, headers: string[]) {
  for (const key of headers) {
    const found = row[normalizedHeader(key)];
    if (found !== undefined && found !== null && String(found).trim()) return String(found).trim();
  }
  return "";
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được kiểm tra file nhập." }, { status: 403 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ success: false, message: "Chưa chọn file dữ liệu." }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ success: false, message: "File tối đa 15 MB." }, { status: 413 });
    if (!/\.(xlsx|xlsm|csv)$/i.test(file.name)) return NextResponse.json({ success: false, message: "Chỉ hỗ trợ file .xlsx, .xlsm hoặc .csv." }, { status: 415 });

    const parsedRows = await readRows(file);
    if (!parsedRows) return NextResponse.json({ success: false, message: "Không tìm thấy cột Tên khách hàng và Số điện thoại." }, { status: 422 });
    if (parsedRows.length > 10_000) return NextResponse.json({ success: false, message: "Mỗi lần nhập tối đa 10.000 dòng." }, { status: 413 });

    const errors: Array<{ row: number; message: string; customerName?: string; phone?: string; serial?: string }> = [];
    const validRows: Array<{ row: number; customerName: string; phone: string; serial: string }> = [];
    const seenPhones = new Set<string>();

    for (const { data, rowNumber } of parsedRows) {
      const customerName = value(data, NAME_HEADERS);
      const phone = normalizePhone(value(data, PHONE_HEADERS));
      const serial = value(data, SERIAL_HEADERS).toUpperCase();
      let error = "";
      if (!customerName) error = "Thiếu tên khách hàng";
      else if (!isValidVietnamPhone(phone)) error = `Số điện thoại không hợp lệ: ${phone || "trống"}`;
      else if (seenPhones.has(phone)) error = "Trùng số điện thoại trong chính file đang nhập";

      if (error) errors.push({ row: rowNumber, message: error, customerName, phone, serial });
      else {
        seenPhones.add(phone);
        validRows.push({ row: rowNumber, customerName, phone, serial });
      }
    }

    const existing = validRows.length
      ? await prisma.customer.findMany({ where: { phone: { in: validRows.map((row) => row.phone) } }, select: { phone: true } })
      : [];
    const existingPhones = new Set(existing.map((row) => row.phone));
    const rows = validRows.slice(0, 30).map((row) => ({ ...row, action: existingPhones.has(row.phone) ? "UPDATE" : "CREATE" }));

    return NextResponse.json({
      success: true,
      message: errors.length ? `Kiểm tra xong: ${errors.length} dòng cần sửa trước khi nhập.` : "Kiểm tra xong. File sẵn sàng để nhập.",
      summary: {
        totalCount: parsedRows.length,
        validCount: validRows.length,
        errorCount: errors.length,
        createCount: validRows.filter((row) => !existingPhones.has(row.phone)).length,
        updateCount: validRows.filter((row) => existingPhones.has(row.phone)).length,
      },
      errors: errors.slice(0, 200),
      rows,
      canImport: errors.length === 0 && validRows.length > 0,
    });
  } catch (error) {
    console.error("customer import preview failed", error);
    return NextResponse.json({ success: false, message: "Không kiểm tra được file dữ liệu." }, { status: 500 });
  }
}
