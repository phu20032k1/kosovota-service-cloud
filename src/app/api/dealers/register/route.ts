import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizePhone, isValidVietnamPhone } from "@/lib/phone";

const REGISTRATION_TYPES = ["commercial", "service", "collaborator"] as const;
type RegistrationType = (typeof REGISTRATION_TYPES)[number];

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ascii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function provinceSegment(value: string) {
  const compact = ascii(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (compact || "XX").padEnd(2, "X").slice(0, 2);
}

function wardSegment(value: string) {
  const cleaned = ascii(value)
    .toUpperCase()
    .replace(/\b(PHUONG|XA|THI TRAN|TT|WARD|COMMUNE)\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`;
  const compact = words[0] || "XX";
  return compact.padEnd(2, "X").slice(0, 2);
}

function isRegistrationType(value: string): value is RegistrationType {
  return (REGISTRATION_TYPES as readonly string[]).includes(value);
}

async function nextDealerCode(provinceCode: string, ward: string) {
  const aa = provinceSegment(provinceCode);
  const bb = wardSegment(ward);
  const yy = String(new Date().getFullYear()).slice(-2);
  const prefix = `${aa}${bb}${yy}`;
  const latest = await prisma.dealer.findFirst({
    where: { dealerCode: { startsWith: prefix } },
    orderBy: { dealerCode: "desc" },
    select: { dealerCode: true },
  });
  const lastSequence = latest ? Number.parseInt(latest.dealerCode.slice(prefix.length), 10) : 0;
  const nextSequence = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;
  return { prefix, nextSequence };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const extra = typeof body.extra === "object" && body.extra ? (body.extra as Record<string, unknown>) : {};
    const representativeName = text(body.representativeName || body.name);
    const companyName = text(extra.companyName || body.companyName);
    const phone = normalizePhone(body.phone);
    const province = text(body.province);
    const provinceCode = text(body.provinceCode || body.province);
    const ward = text(body.ward);
    const registrationTypeRaw = text(extra.registrationType || body.registrationType).toLowerCase();
    const registrationType: RegistrationType = isRegistrationType(registrationTypeRaw) ? registrationTypeRaw : "service";
    const services = Array.isArray(body.services)
      ? body.services.map(text).filter(Boolean).join(", ")
      : text(body.services);
    const citizenId = text(extra.citizenId || body.citizenId);
    const bankAccount = text(extra.bankAccount || body.bankAccount);

    if (!representativeName || !isValidVietnamPhone(phone) || !province || !provinceCode || !ward) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập đủ họ tên, số điện thoại hợp lệ, tỉnh và xã/phường." },
        { status: 400 },
      );
    }
    if (registrationType !== "commercial" && !services) {
      return NextResponse.json(
        { success: false, message: "Đại lý dịch vụ/CTV cần chọn ít nhất một năng lực sửa chữa." },
        { status: 400 },
      );
    }
    if (!citizenId || !bankAccount) {
      return NextResponse.json(
        { success: false, message: "CCCD và số tài khoản là thông tin bắt buộc." },
        { status: 400 },
      );
    }

    const phoneExists = await prisma.dealer.findFirst({ where: { phone }, select: { dealerCode: true } });
    if (phoneExists) {
      return NextResponse.json(
        { success: false, message: `Số điện thoại đã thuộc hồ sơ ${phoneExists.dealerCode}.` },
        { status: 409 },
      );
    }

    const { prefix, nextSequence } = await nextDealerCode(provinceCode, ward);
    let createdDealer = null;

    for (let offset = 0; offset < 20; offset += 1) {
      const sequence = nextSequence + offset;
      if (sequence > 9999) {
        return NextResponse.json(
          { success: false, message: `Khu vực ${prefix} đã hết dải số thứ tự 4 chữ số.` },
          { status: 409 },
        );
      }
      const dealerCode = `${prefix}${String(sequence).padStart(4, "0")}`;
      try {
        createdDealer = await prisma.dealer.create({
          data: {
            dealerCode,
            name: companyName || representativeName,
            phone,
            province,
            address: text(body.address) || null,
            lat: numberOrNull(body.lat),
            lng: numberOrNull(body.lng),
            services: registrationType === "commercial" ? null : services,
            technicianCount:
              registrationType === "commercial"
                ? 0
                : Math.max(1, numberOrNull(body.technicianCount) || 1),
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
            citizenId,
            bankAccount,
            accountHolder: text(extra.accountHolder || body.accountHolder) || null,
            bankName: text(extra.bankName || body.bankName) || null,
            portraitPhoto: text(extra.portraitPhoto || body.portraitPhoto) || null,
            storePhoto: text(extra.storePhoto || body.storePhoto) || null,
            warehousePhoto: text(extra.warehousePhoto || body.warehousePhoto) || null,
            videoName: text(extra.videoName || body.videoName) || null,
          },
        });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
        throw error;
      }
    }

    if (!createdDealer) {
      return NextResponse.json(
        { success: false, message: "Không thể cấp mã đại lý do có nhiều đăng ký đồng thời. Vui lòng thử lại." },
        { status: 409 },
      );
    }

    await prisma.notification.create({
      data: {
        phone,
        channel: "SMS",
        kind: "DEALER_REGISTRATION",
        content: `KOSOVOTA đã nhận đăng ký ${createdDealer.dealerCode}. Mã được sinh tự động theo Tỉnh + Xã/Phường + Năm + STT và đang chờ duyệt.`,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Đăng ký thành công. Mã đại lý tự động: ${createdDealer.dealerCode}.`,
        data: createdDealer,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/dealers/register failed", error);
    return NextResponse.json(
      { success: false, message: "Không tạo được hồ sơ đại lý. Vui lòng kiểm tra dữ liệu và thử lại." },
      { status: 500 },
    );
  }
}
