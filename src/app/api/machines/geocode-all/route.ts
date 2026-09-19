import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { geocodeAddress, reverseGeocodeCoordinates } from "@/lib/maps/geocode";
import {
  isVietnamCoordinates,
  PROVINCE_CODES,
  provinceFromAddress,
  provinceLetterCodeOrNull,
  provinceNamesForScope,
} from "@/lib/province";

function scopeWhere(role: string, scope: string[]): Prisma.MachineWhereInput | undefined {
  if (role !== "CSKH") return undefined;
  const provinceNames = provinceNamesForScope(scope);
  return {
    OR: [
      { provinceCode: { in: scope } },
      ...provinceNames.map((province) => ({ customer: { address: { contains: province, mode: "insensitive" as const } } })),
    ],
  };
}

function needsLocationData(scoped?: Prisma.MachineWhereInput): Prisma.MachineWhereInput {
  return {
    AND: [
      scoped || {},
      {
        OR: [
          { lat: null },
          { lng: null },
          { lat: { lt: 7.5 } },
          { lat: { gt: 24.5 } },
          { lng: { lt: 101 } },
          { lng: { gt: 111.5 } },
          { provinceCode: null },
          { provinceCode: { notIn: [...PROVINCE_CODES] } },
        ],
      },
    ],
  };
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const batchSize = Math.min(500, Math.max(1, Number(body.batchSize) || 100));
  const scope = auth.user.provinceScope?.split(",").map((value) => value.trim()).filter(Boolean) || [];
  const scoped = scopeWhere(auth.user.role, scope);
  const where = needsLocationData(scoped);
  const totalBefore = await prisma.machine.count({ where });
  const candidates = await prisma.machine.findMany({
    where,
    select: { id: true, lat: true, lng: true, provinceCode: true, customer: { select: { address: true } } },
    orderBy: { updatedAt: "desc" },
    take: batchSize,
  });

  let updated = 0;
  let gpsUpdated = 0;
  let provinceUpdated = 0;
  const failed: { machineId: string; address: string; reason: string }[] = [];
  const addressCache = new Map<string, Awaited<ReturnType<typeof geocodeAddress>>>();
  const reverseCache = new Map<string, Awaited<ReturnType<typeof reverseGeocodeCoordinates>>>();

  for (let index = 0; index < candidates.length; index += 5) {
    const batch = candidates.slice(index, index + 5);
    await Promise.all(batch.map(async (machine) => {
      const address = machine.customer?.address?.trim() || "";
      try {
        const hasGps = machine.lat != null && machine.lng != null && isVietnamCoordinates(machine.lat, machine.lng);
        let location: Awaited<ReturnType<typeof geocodeAddress>> = null;

        if (!hasGps && address) {
          const key = address.toLowerCase();
          location = addressCache.get(key) ?? null;
          if (!addressCache.has(key)) {
            location = await geocodeAddress(address);
            addressCache.set(key, location);
          }
        }

        const lat = hasGps ? machine.lat! : location?.lat;
        const lng = hasGps ? machine.lng! : location?.lng;
        let provinceCode =
          provinceLetterCodeOrNull(machine.provinceCode) ||
          provinceFromAddress(address)?.[1] ||
          location?.provinceCode ||
          null;

        if (!provinceCode && lat != null && lng != null) {
          const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
          let reversed = reverseCache.get(key) ?? null;
          if (!reverseCache.has(key)) {
            reversed = await reverseGeocodeCoordinates(lat, lng);
            reverseCache.set(key, reversed);
          }
          provinceCode = reversed?.provinceCode || null;
        }

        const data: { lat?: number; lng?: number; provinceCode?: string } = {};
        if (!hasGps && lat != null && lng != null) {
          data.lat = lat;
          data.lng = lng;
          gpsUpdated += 1;
        }
        if (provinceCode && provinceCode !== machine.provinceCode) {
          data.provinceCode = provinceCode;
          provinceUpdated += 1;
        }

        if (!Object.keys(data).length) {
          failed.push({
            machineId: machine.id,
            address,
            reason: !address && !hasGps
              ? "Thiếu cả địa chỉ và GPS."
              : "Không xác định được tỉnh từ địa chỉ/GPS.",
          });
          return;
        }
        await prisma.machine.update({ where: { id: machine.id }, data });
        updated += 1;
      } catch (error) {
        failed.push({ machineId: machine.id, address, reason: error instanceof Error ? error.message : "Không đồng bộ được vị trí." });
      }
    }));
  }

  const remaining = await prisma.machine.count({ where });
  return NextResponse.json({
    success: true,
    message: `Đã cập nhật ${updated}/${candidates.length} máy (GPS: ${gpsUpdated}, mã tỉnh: ${provinceUpdated}). Còn ${remaining} máy cần kiểm tra.`,
    data: {
      scanned: candidates.length,
      updated,
      gpsUpdated,
      provinceUpdated,
      failedCount: failed.length,
      remaining,
      totalBefore,
      failed: failed.slice(0, 100),
    },
  });
}
