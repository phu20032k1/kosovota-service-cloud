import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { isValidVietnamPhone, normalizePhone } from "@/lib/phone";
import { buildMaintenanceSchedulesFromTemplates, type MaintenanceTemplate } from "@/lib/maintenance";
import { getConfiguredMaintenanceTemplates } from "@/lib/maintenance-config";
import { readSheet } from "read-excel-file/node";
import { geocodeAddress } from "@/lib/maps/geocode";
import { provinceFromAddress, provinceLetterCodeOrNull } from "@/lib/province";

function normalizedHeader(value: unknown) {
  return String(value ?? "")
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

const MACHINE_ID_HEADERS = [
  "id may",
  "machine id",
  "machineid",
  "ma may",
  "seri can in",
  "so seri",
  "so serial",
  "seri",
  "serial",
];

const MODEL_HEADERS = [
  "model",
  "dong may",
  "ten may",
  "ten san pham",
  "ten thiet bi",
  "thong tin may",
  "ma so",
];

const CUSTOMER_PHONE_HEADERS = [
  "sdt khach hang",
  "so dien thoai khach hang",
  "so dien thoai kh",
  "sdt",
  "so dien thoai",
  "dien thoai",
  "phone",
  "mobile",
];

function spreadsheetRows(cells: unknown[][]) {
  const headerIndex = cells.findIndex((row) => {
    const headings = row.map(normalizedHeader);
    const hasMachineId = headings.some((heading) => MACHINE_ID_HEADERS.includes(heading));
    const hasModel = headings.some((heading) => MODEL_HEADERS.includes(heading));
    return hasMachineId && hasModel;
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
  if (/\.csv$/i.test(file.name)) {
    return spreadsheetRows(parseCsv(buffer.toString("utf8").replace(/^\uFEFF/, "")));
  }
  return spreadsheetRows(await readSheet(buffer));
}

function parseExcelDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(Date.UTC(1899, 11, 30) + value * 86400000);
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const date = match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
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

function numberValue(row: Record<string, unknown>, ...keys: string[]) {
  const raw = value(row, ...keys);
  if (!raw) return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function specValue(spec: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = spec.match(new RegExp(`${escaped}\\s*:\\s*([^\\n\\r]+)`, "i"));
  return match?.[1]?.trim() || "";
}

function parseManufactureDate(row: Record<string, unknown>, spec: string) {
  const explicitDate = parseExcelDate(row["Ngày sản xuất"] ?? row["ngay san xuat"]);
  if (explicitDate) return explicitDate;
  const yearText = value(row, "Năm sản xuất", "Nam san xuat") || specValue(spec, "Năm sản xuất");
  const year = Number(yearText.replace(/[^0-9]/g, ""));
  return year >= 2000 && year <= 2100 ? new Date(year, 0, 1) : null;
}

function integerFromText(text: string) {
  const matched = text.match(/\d+/);
  return matched ? Number(matched[0]) : null;
}

function machineInfo(row: Record<string, unknown>) {
  const rawSpec = value(row, "Tên máy", "Ten may", "Thông tin máy", "Thong tin may");
  const serial = value(row, "Seri cần in", "Seri", "Số Seri", "Số Serial", "Serial") || specValue(rawSpec, "Số seri máy");
  const model = value(row, "Model", "Dòng máy", "Mã số") || specValue(rawSpec, "Mã số") || serial.split(".").slice(0, 2).join(".");
  const machineName = specValue(rawSpec, "Tên máy") || value(row, "Tên máy", "Ten may", "Tên sản phẩm", "Tên thiết bị") || model;
  const capacity = value(row, "Công suất", "Dung tích", "Dung tích chứa")
    || specValue(rawSpec, "Công suất")
    || specValue(rawSpec, "Dung tích chứa")
    || specValue(rawSpec, "Dung tích");
  const warrantyText = value(row, "Bảo hành", "Thời gian bảo hành") || specValue(rawSpec, "Bảo hành");
  const warrantyMonths = integerFromText(warrantyText);
  const manufactureDate = parseManufactureDate(row, rawSpec);
  const lines = new Map<string, string>();
  String(rawSpec || "").split(/\r?\n/).forEach((line) => {
    const [label, ...rest] = line.split(":");
    const text = rest.join(":").trim();
    if (label.trim() && text) lines.set(label.trim(), text);
  });
  const extraLabels = [
    "Tên máy", "Mã số", "Công suất", "Số seri máy", "Công nghệ", "Công suất bơm",
    "Điện áp & tần số", "Áp suất làm việc", "Kích thước", "Trọng lượng",
    "Chất lượng nước thành phẩm", "Bảo hành", "Năm sản xuất",
  ];
  extraLabels.forEach((label) => {
    const explicit = value(row, label);
    if (explicit && !lines.has(label)) lines.set(label, explicit);
  });
  if (serial && !lines.has("Số seri máy")) lines.set("Số seri máy", serial);
  if (model && !lines.has("Mã số")) lines.set("Mã số", model);
  if (capacity && !lines.has("Công suất")) lines.set("Công suất", capacity);
  if (warrantyText && !lines.has("Bảo hành")) lines.set("Bảo hành", warrantyText);
  const spec = Array.from(lines.entries()).map(([label, text]) => `${label}: ${text}`).join("\n") || rawSpec;
  return {
    spec,
    serial: serial.toUpperCase(),
    model: model.toUpperCase(),
    machineName,
    capacity,
    warrantyMonths,
    manufactureDate,
  };
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được import dữ liệu." }, { status: 403 });
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ success: false, message: "Chưa chọn file dữ liệu." }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ success: false, message: "File tối đa 15 MB." }, { status: 413 });

    if (!/\.(xlsx|xlsm|csv)$/i.test(file.name)) {
      return NextResponse.json({ success: false, message: "Chỉ hỗ trợ file .xlsx, .xlsm hoặc .csv." }, { status: 415 });
    }
    const parsedRows = await readRows(file);
    if (!parsedRows) {
      return NextResponse.json({ success: false, message: "Không tìm thấy cột hợp lệ. Chấp nhận ID máy/Mã máy/Seri/Số Serial và Model/Dòng máy/Tên máy." }, { status: 422 });
    }
    if (parsedRows.length > 10_000) {
      return NextResponse.json({ success: false, message: "Mỗi lần import tối đa 10.000 dòng." }, { status: 413 });
    }
    let successCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    const errors: { row: number; message: string }[] = [];
    const maintenanceTemplateCache = new Map<string, MaintenanceTemplate[]>();

    for (const { data: row, rowNumber } of parsedRows) {
      try {
        const info = machineInfo(row);
        const machineId = (value(row, ...MACHINE_ID_HEADERS) || info.serial).toUpperCase();
        const model = info.model;
        if (!machineId || !model) throw new Error("Thiếu ID máy/Seri hoặc Model/Mã số");

        const normalizedCustomerPhone = normalizePhone(value(row, ...CUSTOMER_PHONE_HEADERS));
        const phone = isValidVietnamPhone(normalizedCustomerPhone) ? normalizedCustomerPhone : "";
        const customerName = value(row, "Tên khách hàng", "Tên KH", "Họ tên khách hàng", "Customer Name");
        const address = value(row, "Địa chỉ", "Địa chỉ khách hàng", "Địa chỉ giao hàng", "Địa chỉ (Giao hàng)", "Address", "Shipping Address");
        const installDate = parseExcelDate(row["Ngày lắp"] ?? row["Ngày lắp đặt"] ?? row["ngay lap"] ?? row["ngay lap dat"]);
        const provinceInput = value(row, "Mã tỉnh", "Tỉnh", "Tỉnh/Thành", "Tỉnh/Thành phố", "Tỉnh/Thành phố (Giao hàng)", "Tỉnh giao hàng", "Province", "Shipping Province");
        const status = value(row, "Trạng thái", "Status");
        let lat = numberValue(row, "Vĩ độ", "Latitude", "lat");
        let lng = numberValue(row, "Kinh độ", "Longitude", "lng");
        let geocodedProvinceCode: string | undefined;
        if ((lat === null || lng === null) && address && process.env.GEOCODING_ENABLED === "true") {
          try {
            const location = await geocodeAddress(address);
            if (location) {
              lat = location.lat;
              lng = location.lng;
              geocodedProvinceCode = location.provinceCode;
            }
          } catch (geocodeError) {
            console.warn(`Không geocode được dòng ${rowNumber}:`, geocodeError);
          }
        }
        const provinceCode = provinceLetterCodeOrNull(provinceInput)
          || provinceFromAddress(address)?.[1]
          || geocodedProvinceCode
          || "";

        let maintenanceTemplates: MaintenanceTemplate[] | null = null;
        if (installDate) {
          const cacheKey = model.trim().toUpperCase();
          maintenanceTemplates = maintenanceTemplateCache.get(cacheKey) || null;
          if (!maintenanceTemplates) {
            maintenanceTemplates = await getConfiguredMaintenanceTemplates(model);
            maintenanceTemplateCache.set(cacheKey, maintenanceTemplates);
          }
        }

        const outcome = await prisma.$transaction(async (tx) => {
          const customer = phone ? await tx.customer.upsert({
            where: { phone },
            update: {
              ...(customerName ? { name: customerName } : {}),
              ...(address ? { address } : {}),
            },
            create: { name: customerName || "Khách hàng KOSOVOTA", phone, address: address || null },
          }) : null;

          const existingMachine = await tx.machine.findFirst({
            where: info.serial
              ? { OR: [{ id: machineId }, { serial: info.serial }] }
              : { id: machineId },
            select: { id: true },
          });
          const targetMachineId = existingMachine?.id || machineId;

          const machineUpdate = {
            model,
            ...(info.machineName ? { name: info.machineName } : {}),
            ...(info.capacity ? { capacity: info.capacity } : {}),
            ...(info.spec ? { specification: info.spec } : {}),
            ...(info.warrantyMonths !== null ? { warrantyMonths: info.warrantyMonths } : {}),
            ...(info.serial ? { serial: info.serial } : {}),
            ...(info.manufactureDate ? { manufactureDate: info.manufactureDate } : {}),
            ...(provinceCode ? { provinceCode } : {}),
            ...(status ? { status } : {}),
            ...(installDate ? { installDate } : {}),
            ...(customer ? { customerId: customer.id } : {}),
            ...(lat !== null ? { lat } : {}),
            ...(lng !== null ? { lng } : {}),
          };

          await tx.machine.upsert({
            where: { id: targetMachineId },
            update: machineUpdate,
            create: {
              id: machineId,
              model,
              name: info.machineName || null,
              capacity: info.capacity || null,
              specification: info.spec || null,
              warrantyMonths: info.warrantyMonths,
              serial: info.serial || null,
              manufactureDate: info.manufactureDate,
              provinceCode: provinceCode || null,
              status: status || "NEW",
              installDate,
              customerId: customer?.id || null,
              lat,
              lng,
            },
          });

          if (installDate && maintenanceTemplates) {
            const count = await tx.maintenanceSchedule.count({ where: { machineId: targetMachineId } });
            if (!count) {
              await tx.maintenanceSchedule.createMany({
                data: buildMaintenanceSchedulesFromTemplates(targetMachineId, installDate, maintenanceTemplates),
              });
            }
          }
          return { existed: Boolean(existingMachine) };
        });
        successCount += 1;
        if (outcome.existed) updatedCount += 1; else createdCount += 1;
      } catch (error) {
        errors.push({ row: rowNumber, message: error instanceof Error ? error.message : "Dữ liệu không hợp lệ" });
      }
    }
    await prisma.adminLog.create({ data: { userId: auth.user.id, action: "IMPORT_MACHINES", target: file.name, detail: `Tạo mới ${createdCount}, cập nhật ${updatedCount}, lỗi ${errors.length}` } });
    return NextResponse.json({ success: true, message: "Đã xử lý file và đồng bộ các cột có dữ liệu.", summary: { successCount, errorCount: errors.length, createdCount, updatedCount }, errors });
  } catch (error) {
    console.error("import machines failed", error);
    return NextResponse.json({ success: false, message: "Không đọc được file máy/seri." }, { status: 500 });
  }
}
