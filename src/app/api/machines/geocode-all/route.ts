import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/maps/geocode";
import { provinceFromAddress, provinceNamesForScope } from "@/lib/province";

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

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const batchSize = Math.min(200, Math.max(1, Number(body.batchSize) || 50));
  const scope = auth.user.provinceScope?.split(",").map((value) => value.trim()).filter(Boolean) || [];
  const scoped = scopeWhere(auth.user.role, scope);
  const missingGps: Prisma.MachineWhereInput = {
    AND: [
      scoped || {},
      { OR: [{ lat: null }, { lng: null }, { lat: { lt: 7.5 } }, { lat: { gt: 24.5 } }, { lng: { lt: 101 } }, { lng: { gt: 111.5 } }] },
      { customer: { address: { not: null } } },
    ],
  };

  const totalBefore = await prisma.machine.count({ where: missingGps });
  const candidates = await prisma.machine.findMany({
    where: missingGps,
    select: { id: true, provinceCode: true, customer: { select: { address: true } } },
    orderBy: { updatedAt: "desc" },
    take: batchSize,
  });

  let updated = 0;
  const failed: { machineId: string; address: string; reason: string }[] = [];
  const cache = new Map<string, Awaited<ReturnType<typeof geocodeAddress>>>();

  for (let index = 0; index < candidates.length; index += 5) {
    const batch = candidates.slice(index, index + 5);
    await Promise.all(batch.map(async (machine) => {
      const address = machine.customer?.address?.trim() || "";
      if (!address) return;
      try {
        const key = address.toLowerCase();
        let location = cache.get(key);
        if (location === undefined) {
          location = await geocodeAddress(address);
          cache.set(key, location);
        }
        if (!location) {
          failed.push({ machineId: machine.id, address, reason: "Địa chỉ mơ hồ hoặc không đủ độ tin cậy để ghim." });
          return;
        }
        const province = provinceFromAddress(address);
        await prisma.machine.update({
          where: { id: machine.id },
          data: {
            lat: location.lat,
            lng: location.lng,
            ...(!machine.provinceCode && province ? { provinceCode: province[1] } : {}),
          },
        });
        updated += 1;
      } catch (error) {
        failed.push({ machineId: machine.id, address, reason: error instanceof Error ? error.message : "Không geocode được." });
      }
    }));
  }

  const remaining = Math.max(0, totalBefore - updated);
  return NextResponse.json({
    success: true,
    message: `Đã tự ghim ${updated}/${candidates.length} máy trong đợt này. Còn ${remaining} địa chỉ cần xử lý/kiểm tra.`,
    data: { scanned: candidates.length, updated, failedCount: failed.length, remaining, failed: failed.slice(0, 100) },
  });
}
