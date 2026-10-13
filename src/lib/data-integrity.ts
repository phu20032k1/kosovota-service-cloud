import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/maps/geocode";
import { addressWithProvince, isVietnamCoordinates } from "@/lib/province";
import { bumpDealerCacheVersion } from "@/lib/redis";

function normalizeDealerCode(value?: string | null) {
  return value?.trim().toUpperCase() || "";
}

/**
 * Sửa các quan hệ User -> Dealer có thể suy ra chắc chắn từ dữ liệu hiện hữu.
 * - DEALER có dealerCode nhưng thiếu hồ sơ: tạo hồ sơ đại lý tối thiểu.
 * - CTV độc lập (mã CTV-...) thiếu hồ sơ: tạo hồ sơ cộng tác viên tối thiểu.
 * - CTV/KTV liên kết tới mã đại lý không tồn tại: chỉ báo lỗi, không tạo đại lý giả.
 */
export async function reconcileDealerProfiles(limitInput = 1_000) {
  const limit = Math.min(2_000, Math.max(1, Number(limitInput) || 1_000));
  const users = await prisma.user.findMany({
    where: {
      role: { in: ["DEALER", "CTV", "KTV"] },
      dealerCode: { not: null },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      dealerCode: true,
    },
    orderBy: { id: "asc" },
    take: limit,
  });

  const codes = [...new Set(users.map((user) => normalizeDealerCode(user.dealerCode)).filter(Boolean))];
  const dealers = codes.length
    ? await prisma.dealer.findMany({
        where: { dealerCode: { in: codes } },
        select: { dealerCode: true },
      })
    : [];
  const existing = new Set(dealers.map((dealer) => normalizeDealerCode(dealer.dealerCode)));

  let created = 0;
  let alreadyLinked = 0;
  const missingReferences: Array<{ userId: string; role: string; dealerCode: string }> = [];
  const failed: Array<{ userId: string; dealerCode: string; reason: string }> = [];

  for (const user of users) {
    const dealerCode = normalizeDealerCode(user.dealerCode);
    if (!dealerCode) continue;
    if (existing.has(dealerCode)) {
      alreadyLinked += 1;
      continue;
    }

    const isStandaloneCtv = user.role === "CTV" && dealerCode.startsWith("CTV-");
    const canCreate = user.role === "DEALER" || isStandaloneCtv;
    if (!canCreate) {
      missingReferences.push({ userId: user.id, role: user.role, dealerCode });
      continue;
    }

    try {
      await prisma.dealer.create({
        data: {
          dealerCode,
          name: isStandaloneCtv ? `CTV độc lập - ${user.name}` : user.name,
          phone: user.phone,
          email: user.email,
          representativeName: user.name,
          registrationType: isStandaloneCtv ? "collaborator" : null,
          technicianCount: isStandaloneCtv ? 1 : null,
          status: "APPROVED",
        },
      });
      existing.add(dealerCode);
      created += 1;
    } catch (error) {
      failed.push({
        userId: user.id,
        dealerCode,
        reason: error instanceof Error ? error.message : "Không tạo được hồ sơ đại lý.",
      });
    }
  }

  if (created > 0) await bumpDealerCacheVersion();

  return {
    scanned: users.length,
    created,
    alreadyLinked,
    missingReferences,
    failed,
  };
}

function hasMissingCoordinates(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return true;
  return !isVietnamCoordinates(lat, lng) || (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001);
}

async function moveGeocodeCandidateToBack(id: string) {
  // updatedAt cũng đóng vai trò cursor mềm cho job GPS. Khi địa chỉ không thể
  // geocode, đẩy bản ghi về cuối hàng để các đại lý khác không bị chặn mãi.
  await prisma.dealer.update({
    where: { id },
    data: { updatedAt: new Date() },
  }).catch(() => undefined);
}

/**
 * Tự xử lý một lô nhỏ đại lý có địa chỉ nhưng chưa có GPS. Job này chạy từ
 * cron nên bản đồ không còn phụ thuộc vào việc một người mở trang và bấm đồng bộ.
 */
export async function geocodeMissingDealerCoordinates(limitInput = 25) {
  const limit = Math.min(50, Math.max(1, Number(limitInput) || 25));
  const candidates = await prisma.dealer.findMany({
    where: {
      status: "APPROVED",
      address: { not: null },
    },
    select: {
      id: true,
      dealerCode: true,
      address: true,
      province: true,
      lat: true,
      lng: true,
    },
    orderBy: { updatedAt: "asc" },
    take: Math.max(limit * 4, limit),
  });

  const dealers = candidates.filter((dealer) => hasMissingCoordinates(dealer.lat, dealer.lng)).slice(0, limit);
  let attempted = 0;
  let updated = 0;
  let failed = 0;
  const errors: Array<{ dealerCode: string; message: string }> = [];

  for (const dealer of dealers) {
    const address = dealer.address?.trim() || "";
    if (!address) continue;
    attempted += 1;
    const query = addressWithProvince(address, dealer.province);
    try {
      const location = await geocodeAddress(query);
      if (!location || !isVietnamCoordinates(location.lat, location.lng)) {
        failed += 1;
        await moveGeocodeCandidateToBack(dealer.id);
        if (errors.length < 10) {
          errors.push({ dealerCode: dealer.dealerCode, message: `Không xác định được GPS cho: ${query}` });
        }
        continue;
      }
      await prisma.dealer.update({
        where: { id: dealer.id },
        data: { lat: location.lat, lng: location.lng },
      });
      updated += 1;
    } catch (error) {
      failed += 1;
      await moveGeocodeCandidateToBack(dealer.id);
      if (errors.length < 10) {
        errors.push({
          dealerCode: dealer.dealerCode,
          message: error instanceof Error ? error.message : "Không geocode được địa chỉ.",
        });
      }
    }
  }

  if (updated > 0) await bumpDealerCacheVersion();

  return {
    scanned: dealers.length,
    attempted,
    updated,
    failed,
    errors,
  };
}
