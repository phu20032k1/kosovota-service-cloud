import { NextRequest, NextResponse } from "next/server";
import { readSheet } from "read-excel-file/node";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { isValidVietnamPhone, normalizePhone } from "@/lib/phone";

function normalizedHeader(input: unknown) {
  return String(input ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").trim().toLowerCase().replace(/\s+/g, " ");
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

function value(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const found = row[normalizedHeader(key)];
    if (found !== undefined && found !== null && String(found).trim()) return String(found).trim();
  }
  return "";
}

function excelDate(input: unknown) {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === "number") return new Date(Date.UTC(1899, 11, 30) + input * 86400000);
  const text = String(input).trim();
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const parsed = match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được nhập khách hàng." }, { status: 403 });
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ success: false, message: "Chưa chọn file Excel." }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ success: false, message: "File Excel tối đa 15 MB." }, { status: 413 });
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) return NextResponse.json({ success: false, message: "Chỉ hỗ trợ file .xlsx hoặc .xlsm." }, { status: 415 });

    const parsedRows = rowsFromSheet(await readSheet(Buffer.from(await file.arrayBuffer())));
    if (!parsedRows) return NextResponse.json({ success: false, message: "Không tìm thấy cột Tên khách hàng và Số điện thoại." }, { status: 422 });
    if (parsedRows.length > 10_000) return NextResponse.json({ success: false, message: "Mỗi lần nhập tối đa 10.000 dòng." }, { status: 413 });

    let createdCount = 0;
    let updatedCount = 0;
    let linkedMachineCount = 0;
    const errors: { row: number; message: string }[] = [];

    for (const { data: row, rowNumber } of parsedRows) {
      try {
        const name = value(row, "Tên khách hàng", "Họ tên", "Customer name", "Tên");
        const phone = normalizePhone(value(row, "SĐT", "Số điện thoại", "Điện thoại", "Phone"));
        if (!name) throw new Error("Thiếu tên khách hàng");
        if (!isValidVietnamPhone(phone)) throw new Error("Số điện thoại không hợp lệ");
        const machineKey = value(row, "ID máy", "Mã máy", "Số Seri", "Seri", "Serial").toUpperCase();
        const machineModel = value(row, "Model", "Dòng máy", "Tên máy");
        const installDate = excelDate(row[normalizedHeader("Ngày lắp đặt")] ?? row[normalizedHeader("Ngày lắp")]);

        const outcome = await prisma.$transaction(async (tx) => {
          const existed = await tx.customer.findUnique({ where: { phone }, select: { id: true } });
          const ownerText = value(row, "CSKH phụ trách", "Nhân viên phụ trách", "Owner");
          const owner = ownerText ? await tx.user.findFirst({ where: { active: true, role: { in: ["ADMIN", "CSKH"] }, OR: [{ name: ownerText }, { phone: normalizePhone(ownerText) }] }, select: { id: true } }) : null;
          const customer = await tx.customer.upsert({
            where: { phone },
            create: { name, phone, email: value(row, "Email") || null, address: value(row, "Địa chỉ", "Address") || null, segment: value(row, "Phân khúc", "Segment").toUpperCase() || "STANDARD", tags: value(row, "Nhãn", "Tags") || null, ownerId: owner?.id || null },
            update: { name, email: value(row, "Email") || undefined, address: value(row, "Địa chỉ", "Address") || undefined, segment: value(row, "Phân khúc", "Segment").toUpperCase() || undefined, tags: value(row, "Nhãn", "Tags") || undefined, ownerId: owner?.id || undefined },
          });

          let linked = false;
          if (machineKey) {
            const machine = await tx.machine.findFirst({ where: { OR: [{ id: machineKey }, { serial: machineKey }] }, select: { id: true } });
            if (machine) {
              await tx.machine.update({ where: { id: machine.id }, data: { customerId: customer.id, installDate: installDate || undefined } });
              linked = true;
            } else if (machineModel) {
              await tx.machine.create({ data: { id: machineKey, serial: machineKey, model: machineModel.toUpperCase(), name: machineModel, customerId: customer.id, installDate, status: installDate ? "ACTIVE" : "NEW" } });
              linked = true;
            } else throw new Error(`Không tìm thấy máy ${machineKey}; cần cột Model/Tên máy để tạo mới`);
          }
          return { created: !existed, linked };
        });
        if (outcome.created) createdCount += 1; else updatedCount += 1;
        if (outcome.linked) linkedMachineCount += 1;
      } catch (error) {
        errors.push({ row: rowNumber, message: error instanceof Error ? error.message : "Dữ liệu không hợp lệ" });
      }
    }

    await prisma.adminLog.create({ data: { userId: auth.user.id, action: "IMPORT_CUSTOMERS", target: file.name, detail: `Tạo ${createdCount}, cập nhật ${updatedCount}, gắn máy ${linkedMachineCount}, lỗi ${errors.length}` } });
    return NextResponse.json({ success: true, message: "Đã xử lý file khách hàng.", summary: { successCount: createdCount + updatedCount, createdCount, updatedCount, linkedMachineCount, errorCount: errors.length }, errors });
  } catch (error) {
    console.error("import customers failed", error);
    return NextResponse.json({ success: false, message: "Không đọc được file Excel khách hàng." }, { status: 500 });
  }
}
