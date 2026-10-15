import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cachePart, getRedis, redisGet, redisSet } from "@/lib/redis";
import { getDealerCacheFingerprint } from "@/lib/dealer-cache";
import { findProvince, provinceName } from "@/lib/province";

function canonicalProvinceCode(value?: string | null) {
  return findProvince(value)?.[1] || value?.trim().toUpperCase() || "";
}

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "SUPER_ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  const scopes = auth.user.provinceScope?.split(",").map((value) => value.trim()).filter(Boolean) || [];
  const canonicalScopes = new Set(scopes.map(canonicalProvinceCode).filter(Boolean));
  const scopeKey = auth.user.role === "CSKH" ? [...canonicalScopes].sort().join("|") : "ALL";
  const fingerprint = await getDealerCacheFingerprint();
  const key = `kosovota:dealer-map:v2:${fingerprint}:${cachePart(scopeKey)}`;
  const cached = await redisGet<unknown[]>(key);

  if (Array.isArray(cached)) {
    return NextResponse.json({ success: true, data: cached, cache: "HIT", cacheFingerprint: fingerprint });
  }

  const dealers = await prisma.dealer.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      dealerCode: true,
      name: true,
      companyName: true,
      representativeName: true,
      birthDate: true,
      phone: true,
      email: true,
      address: true,
      province: true,
      locationType: true,
      serviceArea: true,
      services: true,
      technicianCount: true,
      rating: true,
      registrationType: true,
      lat: true,
      lng: true,
      storePhoto: true,
      warehousePhoto: true,
      portraitPhoto: true,
      status: true,
    },
    orderBy: [{ province: "asc" }, { name: "asc" }],
  });

  const visibleDealers = auth.user.role === "CSKH" && canonicalScopes.size
    ? dealers.filter((dealer) => canonicalScopes.has(canonicalProvinceCode(dealer.province)))
    : dealers;

  const safeDealers = visibleDealers.map((dealer) => {
    const valid = dealer.lat != null && dealer.lng != null
      && dealer.lat >= 7.5 && dealer.lat <= 24.5 && dealer.lng >= 101 && dealer.lng <= 111.5;
    return {
      ...dealer,
      province: provinceName(dealer.province) || dealer.province,
      ...(valid ? {} : { lat: null, lng: null }),
    };
  });
  const cachedSuccessfully = await redisSet(key, safeDealers, 300);
  return NextResponse.json({
    success: true,
    data: safeDealers,
    cache: getRedis() ? (cachedSuccessfully ? "MISS" : "ERROR") : "DISABLED",
    cacheFingerprint: fingerprint,
  });
}
