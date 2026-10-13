import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/maps/geocode";
import { bumpDealerCacheVersion } from "@/lib/redis";
import { writeAudit } from "@/lib/audit";
import { addressWithProvince } from "@/lib/province";

const PAGE_SIZE = 20;

function hasUsableCoordinates(lat: number | null, lng: number | null) {
  if (lat === null || lng === null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return !(Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001);
}

function geocodingConfigurationError() {
  const provider = (process.env.GEOCODING_PROVIDER || process.env.NEXT_PUBLIC_MAP_PROVIDER || "maptiler").toLowerCase();
  if (provider === "google") {
    if (!process.env.GOOGLE_MAPS_SERVER_API_KEY && !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      return "Thiếu GOOGLE_MAPS_SERVER_API_KEY cho Google Geocoding.";
    }
    return "";
  }

  if (!process.env.MAPTILER_SERVER_API_KEY && !process.env.NEXT_PUBLIC_MAPTILER_KEY) {
    return "Thiếu MAPTILER_SERVER_API_KEY cho MapTiler Geocoding.";
  }
  return "";
}

function fullAddress(address: string, province?: string | null) {
  const trimmedAddress = address.trim();
  if (!trimmedAddress) return "";
  // province trong dữ liệu lịch sử có thể là mã số (01), mã chữ (HN) hoặc tên.
  // Luôn đổi sang tên tỉnh trước khi gửi nhà cung cấp bản đồ để tránh query kiểu
  // "địa chỉ, 01" khiến MapTiler/Google không nhận diện đúng địa phương.
  return addressWithProvince(trimmedAddress, province);
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) {
    return NextResponse.json({ success: false, message: "Chỉ Admin được đồng bộ GPS hàng loạt." }, { status: 403 });
  }

  const configError = geocodingConfigurationError();
  if (configError) {
    return NextResponse.json({ success: false, message: configError }, { status: 409 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const cursor = typeof body.cursor === "string" && body.cursor.trim() ? body.cursor.trim() : null;
    const force = body.force === true;

    const rows = await prisma.dealer.findMany({
      where: { address: { not: null } },
      select: {
        id: true,
        dealerCode: true,
        address: true,
        province: true,
        lat: true,
        lng: true,
      },
      orderBy: { id: "asc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const page = rows.slice(0, PAGE_SIZE);
    const nextCursor = rows.length > PAGE_SIZE && page.length ? page[page.length - 1].id : null;
    let attempted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: { dealerCode: string; message: string }[] = [];

    for (const dealer of page) {
      const address = dealer.address?.trim() || "";
      if (!address) {
        skipped += 1;
        continue;
      }

      if (!force && hasUsableCoordinates(dealer.lat, dealer.lng)) {
        skipped += 1;
        continue;
      }

      attempted += 1;
      try {
        const query = fullAddress(address, dealer.province);
        const location = await geocodeAddress(query);
        if (!location || !hasUsableCoordinates(location.lat, location.lng)) {
          failed += 1;
          if (errors.length < 20) errors.push({ dealerCode: dealer.dealerCode, message: `Không tìm thấy tọa độ phù hợp cho: ${query}` });
          continue;
        }

        await prisma.dealer.update({
          where: { id: dealer.id },
          data: { lat: location.lat, lng: location.lng },
        });
        updated += 1;
      } catch (error) {
        failed += 1;
        if (errors.length < 20) {
          errors.push({
            dealerCode: dealer.dealerCode,
            message: error instanceof Error ? error.message : "Không geocode được địa chỉ.",
          });
        }
      }
    }

    if (updated > 0) await bumpDealerCacheVersion();

    await writeAudit({
      request,
      userId: auth.user.id,
      action: "BULK_GEOCODE_DEALERS",
      target: force ? "ALL_WITH_ADDRESS" : "MISSING_GPS",
      detail: {
        scanned: page.length,
        attempted,
        updated,
        skipped,
        failed,
        force,
        hasMore: Boolean(nextCursor),
      },
    });

    return NextResponse.json({
      success: true,
      message: updated > 0 ? `Đã cập nhật GPS cho ${updated} đại lý/CTV trong đợt này.` : "Đợt này không có GPS mới được cập nhật.",
      data: {
        scanned: page.length,
        attempted,
        updated,
        skipped,
        failed,
        nextCursor,
        hasMore: Boolean(nextCursor),
        force,
      },
      errors,
    });
  } catch (error) {
    console.error("POST /api/dealers/geocode-all failed", error);
    return NextResponse.json({ success: false, message: "Không đồng bộ được GPS hàng loạt." }, { status: 500 });
  }
}
