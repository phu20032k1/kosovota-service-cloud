import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { isValidVietnamPhone, normalizePhone } from "@/lib/phone";
import { writeAudit } from "@/lib/audit";
import { geocodeAddress } from "@/lib/maps/geocode";
import { bumpDealerCacheVersion } from "@/lib/redis";

type Params = { params: Promise<{ id: string }> };
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function numberOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function hasUsableCoordinates(lat: number | null, lng: number | null) {
  if (lat === null || lng === null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return !(Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001);
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 403 });
  const { id } = await params;
  const dealer = await prisma.dealer.findUnique({ where: { id }, include: { serviceOrders: { orderBy: { createdAt: "desc" }, take: 100 }, supportTickets: { orderBy: { createdAt: "desc" }, take: 100 }, paymentBatches: { orderBy: { createdAt: "desc" }, take: 50 } } });
  if (!dealer) return NextResponse.json({ success: false, message: "Không tìm thấy đại lý." }, { status: 404 });
  const data = hasUsableCoordinates(dealer.lat, dealer.lng) ? dealer : { ...dealer, lat: null, lng: null };
  return NextResponse.json({ success: true, data });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được sửa đại lý." }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const current = await prisma.dealer.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ success: false, message: "Không tìm thấy đại lý." }, { status: 404 });
  const dealerCode = text(body.dealerCode).toUpperCase();
  const name = text(body.name);
  const phone = normalizePhone(text(body.phone));
  if (!dealerCode || !name || !isValidVietnamPhone(phone)) return NextResponse.json({ success: false, message: "Mã đại lý, tên và số điện thoại hợp lệ là bắt buộc." }, { status: 400 });
  const conflict = await prisma.dealer.findFirst({ where: { dealerCode, id: { not: id } }, select: { id: true } });
  if (conflict) return NextResponse.json({ success: false, message: "Mã đại lý đã được sử dụng." }, { status: 409 });

  try {
    const address = text(body.address);
    const addressChanged = address !== (current.address || "").trim();
    const requestedLat = numberOrNull(body.lat);
    const requestedLng = numberOrNull(body.lng);
    const manualCoordinates = hasUsableCoordinates(requestedLat, requestedLng);
    let nextLat = manualCoordinates ? requestedLat : current.lat;
    let nextLng = manualCoordinates ? requestedLng : current.lng;
    let gpsAutoFilled = false;
    let geocodeAttempted = false;

    if (!address) {
      nextLat = null;
      nextLng = null;
    } else if (!manualCoordinates && (addressChanged || !hasUsableCoordinates(current.lat, current.lng))) {
      geocodeAttempted = true;
      if (process.env.GEOCODING_ENABLED === "true") {
        try {
          const location = await geocodeAddress(address);
          if (location && hasUsableCoordinates(location.lat, location.lng)) {
            nextLat = location.lat;
            nextLng = location.lng;
            gpsAutoFilled = true;
          } else {
            nextLat = null;
            nextLng = null;
          }
        } catch (error) {
          console.warn(`Không tự lấy được GPS cho đại lý ${current.dealerCode}:`, error);
          nextLat = null;
          nextLng = null;
        }
      } else if (addressChanged || !hasUsableCoordinates(current.lat, current.lng)) {
        nextLat = null;
        nextLng = null;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const dealer = await tx.dealer.update({ where: { id }, data: {
        dealerCode, name, phone,
        representativeName: text(body.representativeName) || null,
        companyName: text(body.companyName) || null,
        registrationType: text(body.registrationType) || null,
        birthDate: text(body.birthDate) ? new Date(text(body.birthDate)) : null,
        locationType: text(body.locationType) || null,
        email: text(body.email) || null,
        province: text(body.province) || null,
        address: address || null,
        lat: nextLat,
        lng: nextLng,
        services: text(body.services) || null,
        technicianCount: Number.isFinite(Number(body.technicianCount)) ? Number(body.technicianCount) : null,
        serviceArea: text(body.serviceArea) || null,
        taxCode: text(body.taxCode) || null,
        citizenId: text(body.citizenId) || null,
        bankAccount: text(body.bankAccount) || null,
        accountHolder: text(body.accountHolder) || null,
        bankName: text(body.bankName) || null,
        videoName: text(body.videoName) || null,
      } });
      if (current.dealerCode !== dealerCode) await tx.user.updateMany({ where: { dealerCode: current.dealerCode }, data: { dealerCode } });
      return dealer;
    });
    await bumpDealerCacheVersion();
    await writeAudit({
      request,
      userId: auth.user.id,
      action: "UPDATE_DEALER_PROFILE",
      target: dealerCode,
      detail: { previousCode: current.dealerCode, addressChanged, gpsAutoFilled },
    });

    let message = "Đã cập nhật hồ sơ và đồng bộ mã tài khoản đại lý/KTV.";
    if (gpsAutoFilled) message += " GPS đã tự cập nhật từ địa chỉ.";
    else if (geocodeAttempted && address && !hasUsableCoordinates(nextLat, nextLng)) {
      message += process.env.GEOCODING_ENABLED === "true"
        ? " Chưa xác định được GPS từ địa chỉ này."
        : " GPS chưa được tự lấy vì dịch vụ geocoding đang tắt.";
    }

    return NextResponse.json({ success: true, message, data: updated });
  } catch (error) {
    console.error("PUT dealer detail failed", error);
    return NextResponse.json({ success: false, message: "Không cập nhật được hồ sơ đại lý." }, { status: 500 });
  }
}
