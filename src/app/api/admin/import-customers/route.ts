import { NextRequest, NextResponse } from "next/server";
import { readSheet } from "read-excel-file/node";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { isValidVietnamPhone, normalizePhone } from "@/lib/phone";
import { geocodeAddress } from "@/lib/maps/geocode";

type Coordinates = { lat: number | null; lng: number | null; explicit: boolean };

function normalizedHeader(input: unknown) {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase()
    .replace(/[._/-]+/g, " ")
    .replace(/\s+/g, " ");
}

function rowsFromSheet(cells: unknown[][]) {
  const headerIndex = cells.findIndex((row) => {
    const headers = row.map(normalizedHeader);
    return headers.some((value) => ["ten khach hang", "ho ten", "customer name", "ten"].includes(value))
      && headers.some((value) => ["sdt", "so dien thoai", "dien thoai", "phone"].includes(value));
  });
  if (headerIndex < 0) return null;
  const headers = cells[headerIndex].map((cell) => normalizedHeader(cell));
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
  if (/\.csv$/i.test(file.name)) {
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
    return rowsFromSheet(parseCsv(text));
  }
  return rowsFromSheet(await readSheet(buffer));
}

function value(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const found = row[normalizedHeader(key)];
    if (found !== undefined && found !== null && String(found).trim()) return String(found).trim();
  }
  return "";
}

function rawValue(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const found = row[normalizedHeader(key)];
    if (found !== undefined && found !== null && String(found).trim()) return found;
  }
  return null;
}

function excelDate(input: unknown) {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === "number") {
    if (Number.isInteger(input) && input >= 1900 && input <= 2100) return new Date(Date.UTC(input, 0, 1));
    return new Date(Date.UTC(1899, 11, 30) + input * 86400000);
  }
  const text = String(input).trim();
  if (!text) return null;
  if (/^(19|20)\d{2}$/.test(text)) return new Date(Date.UTC(Number(text), 0, 1));
  const monthYear = text.match(/^(\d{1,2})[/-](\d{4})$/);
  if (monthYear) {
    const month = Number(monthYear[1]);
    const year = Number(monthYear[2]);
    if (month >= 1 && month <= 12) return new Date(Date.UTC(year, month - 1, 1));
  }
  const dayMonthYear = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const parsed = dayMonthYear
    ? new Date(Date.UTC(Number(dayMonthYear[3]), Number(dayMonthYear[2]) - 1, Number(dayMonthYear[1])))
    : new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function integerOrNull(input: string) {
  if (!input.trim()) return null;
  const parsed = Number.parseInt(input.replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrNull(input: string) {
  if (!input.trim()) return null;
  const parsed = Number(input.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function hasUsableCoordinates(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return !(Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001);
}

async function coordinatesFromAddress(
  address: string,
  inputLat: number | null,
  inputLng: number | null,
  cache: Map<string, Coordinates>,
): Promise<Coordinates> {
  if (hasUsableCoordinates(inputLat, inputLng)) return { lat: inputLat, lng: inputLng, explicit: true };
  if (!address || process.env.GEOCODING_ENABLED !== "true") return { lat: null, lng: null, explicit: false };
  const cacheKey = address.trim().toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  try {
    const result = await geocodeAddress(address);
    const coordinates: Coordinates = result && hasUsableCoordinates(result.lat, result.lng)
      ? { lat: result.lat, lng: result.lng, explicit: false }
      : { lat: null, lng: null, explicit: false };
    cache.set(cacheKey, coordinates);
    return coordinates;
  } catch (error) {
    console.warn(`Không geocode được địa chỉ khách hàng ${address}:`, error);
    const coordinates = { lat: null, lng: null, explicit: false };
    cache.set(cacheKey, coordinates);
    return coordinates;
  }
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được nhập khách hàng." }, { status: 403 });
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ success: false, message: "Chưa chọn file dữ liệu." }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ success: false, message: "File tối đa 15 MB." }, { status: 413 });
    if (!/\.(xlsx|xlsm|csv)$/i.test(file.name)) return NextResponse.json({ success: false, message: "Chỉ hỗ trợ file .xlsx, .xlsm hoặc .csv." }, { status: 415 });

    const parsedRows = await readRows(file);
    if (!parsedRows) return NextResponse.json({ success: false, message: "Không tìm thấy cột Tên khách hàng và Số điện thoại." }, { status: 422 });
    if (parsedRows.length > 10_000) return NextResponse.json({ success: false, message: "Mỗi lần nhập tối đa 10.000 dòng." }, { status: 413 });

    let createdCount = 0;
    let updatedCount = 0;
    let linkedMachineCount = 0;
    let gpsUpdatedCount = 0;
    let lifecycleUpdatedCount = 0;
    const errors: { row: number; message: string }[] = [];
    const geocodeCache = new Map<string, Coordinates>();

    for (const { data: row, rowNumber } of parsedRows) {
      try {
        const name = value(row, "Tên khách hàng", "Họ tên", "Customer name", "Tên");
        const phone = normalizePhone(value(row, "SĐT", "Số điện thoại", "Điện thoại", "Phone"));
        if (!name) throw new Error("Thiếu tên khách hàng");
        if (!isValidVietnamPhone(phone)) throw new Error(`Số điện thoại không hợp lệ: ${phone || "trống"}`);

        const address = value(row, "Địa chỉ", "Address");
        const machineKey = value(row, "ID máy", "Mã máy", "Số Seri", "Số Serial", "Seri", "Serial").toUpperCase();
        const machineModel = value(row, "Model", "Dòng máy");
        const machineName = value(row, "Tên máy", "Tên thiết bị", "Tên sản phẩm");
        const effectiveMachineModel = machineModel || machineName;
        const installDate = excelDate(rawValue(row, "Ngày lắp đặt", "Ngày lắp", "Install date"));
        const manufactureDate = excelDate(rawValue(row, "Ngày SX", "Ngày sản xuất", "Thời gian SX", "Manufacture date"));
        const activationDate = excelDate(rawValue(row, "Kích hoạt bảo hành", "Ngày kích hoạt bảo hành", "Ngày kích hoạt", "Activation date"));
        const warrantyMonths = integerOrNull(value(row, "Thời hạn BH", "Tháng bảo hành", "Bảo hành (tháng)", "Warranty months"));
        const inputLat = numberOrNull(value(row, "Vĩ độ", "Latitude", "lat"));
        const inputLng = numberOrNull(value(row, "Kinh độ", "Longitude", "lng"));

        const existingMachineLocation = machineKey
          ? await prisma.machine.findFirst({ where: { OR: [{ id: machineKey }, { serial: machineKey }] }, select: { id: true, lat: true, lng: true } })
          : null;
        const shouldResolveGps = Boolean(machineKey) && (
          hasUsableCoordinates(inputLat, inputLng)
          || !existingMachineLocation
          || !hasUsableCoordinates(existingMachineLocation.lat, existingMachineLocation.lng)
        );
        const coordinates = shouldResolveGps
          ? await coordinatesFromAddress(address, inputLat, inputLng, geocodeCache)
          : { lat: null, lng: null, explicit: false };

        const outcome = await prisma.$transaction(async (tx) => {
          const existed = await tx.customer.findUnique({ where: { phone }, select: { id: true } });
          const ownerText = value(row, "CSKH phụ trách", "Nhân viên phụ trách", "Owner");
          const owner = ownerText
            ? await tx.user.findFirst({ where: { active: true, role: { in: ["ADMIN", "CSKH"] }, OR: [{ name: ownerText }, { phone: normalizePhone(ownerText) }] }, select: { id: true } })
            : null;
          const customer = await tx.customer.upsert({
            where: { phone },
            create: {
              name,
              phone,
              email: value(row, "Email") || null,
              address: address || null,
              segment: value(row, "Phân khúc", "Segment").toUpperCase() || "STANDARD",
              tags: value(row, "Nhãn", "Tags") || null,
              ownerId: owner?.id || null,
            },
            update: {
              name,
              email: value(row, "Email") || undefined,
              address: address || undefined,
              segment: value(row, "Phân khúc", "Segment").toUpperCase() || undefined,
              tags: value(row, "Nhãn", "Tags") || undefined,
              ownerId: owner?.id || undefined,
            },
          });

          let linked = false;
          let gpsUpdated = false;
          let lifecycleUpdated = false;
          if (machineKey) {
            const machine = await tx.machine.findFirst({
              where: { OR: [{ id: machineKey }, { serial: machineKey }] },
              select: { id: true, lat: true, lng: true },
            });
            const machineData = {
              customerId: customer.id,
              ...(installDate ? { installDate } : {}),
              ...(manufactureDate ? { manufactureDate } : {}),
              ...(warrantyMonths !== null && warrantyMonths >= 0 ? { warrantyMonths } : {}),
              ...(machineModel ? { model: machineModel.toUpperCase() } : {}),
              ...(machineName ? { name: machineName } : {}),
              ...(installDate || activationDate ? { status: "ACTIVE" } : {}),
            };

            let machineId: string;
            if (machine) {
              const shouldSetGps = hasUsableCoordinates(coordinates.lat, coordinates.lng)
                && (coordinates.explicit || !hasUsableCoordinates(machine.lat, machine.lng));
              await tx.machine.update({
                where: { id: machine.id },
                data: { ...machineData, ...(shouldSetGps ? { lat: coordinates.lat, lng: coordinates.lng } : {}) },
              });
              machineId = machine.id;
              gpsUpdated = shouldSetGps;
              linked = true;
            } else if (effectiveMachineModel) {
              const created = await tx.machine.create({
                data: {
                  id: machineKey,
                  serial: machineKey,
                  model: effectiveMachineModel.toUpperCase(),
                  name: machineName || effectiveMachineModel,
                  customerId: customer.id,
                  installDate,
                  manufactureDate,
                  warrantyMonths: warrantyMonths !== null && warrantyMonths >= 0 ? warrantyMonths : null,
                  lat: coordinates.lat,
                  lng: coordinates.lng,
                  status: installDate || activationDate ? "ACTIVE" : "NEW",
                },
              });
              machineId = created.id;
              gpsUpdated = hasUsableCoordinates(coordinates.lat, coordinates.lng);
              linked = true;
            } else throw new Error(`Không tìm thấy máy ${machineKey}; cần cột Model/Tên máy để tạo mới`);

            if (activationDate) {
              await tx.activation.upsert({
                where: { machineId_step: { machineId, step: 1 } },
                create: { machineId, step: 1, ownerName: name, ownerPhone: phone, createdAt: activationDate },
                update: { ownerName: name, ownerPhone: phone, createdAt: activationDate },
              });
            }
            lifecycleUpdated = Boolean(installDate || manufactureDate || activationDate || warrantyMonths !== null);
          }
          return { created: !existed, linked, gpsUpdated, lifecycleUpdated };
        });
        if (outcome.created) createdCount += 1; else updatedCount += 1;
        if (outcome.linked) linkedMachineCount += 1;
        if (outcome.gpsUpdated) gpsUpdatedCount += 1;
        if (outcome.lifecycleUpdated) lifecycleUpdatedCount += 1;
      } catch (error) {
        errors.push({ row: rowNumber, message: error instanceof Error ? error.message : "Dữ liệu không hợp lệ" });
      }
    }

    await prisma.adminLog.create({
      data: {
        userId: auth.user.id,
        action: "IMPORT_CUSTOMERS",
        target: file.name,
        detail: `Tạo ${createdCount}, cập nhật ${updatedCount}, gắn máy ${linkedMachineCount}, GPS ${gpsUpdatedCount}, vòng đời ${lifecycleUpdatedCount}, lỗi ${errors.length}`,
      },
    });
    return NextResponse.json({
      success: true,
      message: errors.length
        ? `Đã xử lý file. Có ${errors.length} dòng lỗi; xem chi tiết bên dưới để sửa đúng dòng.`
        : "Đã xử lý toàn bộ file khách hàng và đồng bộ dữ liệu máy/GPS.",
      summary: {
        successCount: createdCount + updatedCount,
        createdCount,
        updatedCount,
        linkedMachineCount,
        gpsUpdatedCount,
        lifecycleUpdatedCount,
        errorCount: errors.length,
      },
      errors,
    });
  } catch (error) {
    console.error("import customers failed", error);
    return NextResponse.json({ success: false, message: "Không đọc được file khách hàng." }, { status: 500 });
  }
}
