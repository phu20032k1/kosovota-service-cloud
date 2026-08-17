import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRedis, redisGet, redisSet } from "@/lib/redis";
import { getDealerCacheFingerprint } from "@/lib/dealer-cache";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) {
    return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  }

  const fingerprint = await getDealerCacheFingerprint();
  const key = `kosovota:dealer-map:${fingerprint}`;
  const cached = await redisGet<unknown[]>(key);

  if (Array.isArray(cached)) {
    return NextResponse.json({
      success: true,
      data: cached,
      cache: "HIT",
      cacheFingerprint: fingerprint,
    });
  }

  const dealers = await prisma.dealer.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      dealerCode: true,
      name: true,
      phone: true,
      address: true,
      province: true,
      services: true,
      technicianCount: true,
      rating: true,
      registrationType: true,
      lat: true,
      lng: true,
      storePhoto: true,
      warehousePhoto: true,
      status: true,
    },
    orderBy: [{ province: "asc" }, { name: "asc" }],
  });

  const cachedSuccessfully = await redisSet(key, dealers, 300);

  return NextResponse.json({
    success: true,
    data: dealers,
    cache: getRedis() ? (cachedSuccessfully ? "MISS" : "ERROR") : "DISABLED",
    cacheFingerprint: fingerprint,
  });
}
