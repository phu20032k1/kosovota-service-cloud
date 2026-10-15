import { prisma } from "@/lib/prisma";
import { findProvince } from "@/lib/province";

function splitScope(scope?: string | null) {
  return String(scope || "")
    .split(/[,;|\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Chuẩn nội bộ duy nhất cho tỉnh/thành là mã chữ nghiệp vụ (HN, HCM, ...).
 * Giá trị lạ được giữ nguyên để không làm mất dữ liệu lịch sử.
 */
export function canonicalProvinceValue(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return findProvince(raw)?.[1] || raw;
}

/**
 * Chuẩn hóa phạm vi tỉnh của tài khoản về mã chữ nghiệp vụ (HN, HCM, ...).
 * Giá trị không nhận diện được được giữ nguyên để không làm mất dữ liệu lịch sử.
 */
export function canonicalProvinceScope(scope?: string | null) {
  const values = splitScope(scope);
  if (!values.length) return null;
  const normalized = new Set(
    values.map((value) => canonicalProvinceValue(value) || value),
  );
  return [...normalized].join(",");
}

/**
 * Tự sửa dữ liệu User.provinceScope cũ đã lưu lẫn mã số / mã chữ / tên tỉnh.
 * Chỉ cập nhật khi giá trị chuẩn khác giá trị hiện tại và không xóa token lạ.
 */
export async function normalizeUserProvinceScopes(limitInput = 1_000) {
  const limit = Math.min(2_000, Math.max(1, Number(limitInput) || 1_000));
  const users = await prisma.user.findMany({
    where: { provinceScope: { not: null } },
    select: { id: true, provinceScope: true },
    orderBy: { id: "asc" },
    take: limit,
  });

  let updated = 0;
  const failed: Array<{ userId: string; reason: string }> = [];

  for (const user of users) {
    const normalized = canonicalProvinceScope(user.provinceScope);
    if (!normalized || normalized === user.provinceScope) continue;
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { provinceScope: normalized },
      });
      updated += 1;
    } catch (error) {
      failed.push({
        userId: user.id,
        reason: error instanceof Error ? error.message : "Không chuẩn hóa được phạm vi tỉnh.",
      });
    }
  }

  return { scanned: users.length, updated, failed };
}

export async function normalizeDealerProvinces(limitInput = 1_000) {
  const limit = Math.min(2_000, Math.max(1, Number(limitInput) || 1_000));
  const dealers = await prisma.dealer.findMany({
    where: { province: { not: null } },
    select: { id: true, province: true },
    orderBy: { id: "asc" },
    take: limit,
  });

  let updated = 0;
  const failed: Array<{ dealerId: string; reason: string }> = [];
  for (const dealer of dealers) {
    const normalized = canonicalProvinceValue(dealer.province);
    if (!normalized || normalized === dealer.province) continue;
    try {
      await prisma.dealer.update({ where: { id: dealer.id }, data: { province: normalized } });
      updated += 1;
    } catch (error) {
      failed.push({ dealerId: dealer.id, reason: error instanceof Error ? error.message : "Không chuẩn hóa được tỉnh đại lý." });
    }
  }
  return { scanned: dealers.length, updated, failed };
}

export async function normalizeMachineProvinceCodes(limitInput = 1_000) {
  const limit = Math.min(2_000, Math.max(1, Number(limitInput) || 1_000));
  const machines = await prisma.machine.findMany({
    where: { provinceCode: { not: null } },
    select: { id: true, provinceCode: true },
    orderBy: { id: "asc" },
    take: limit,
  });

  let updated = 0;
  const failed: Array<{ machineId: string; reason: string }> = [];
  for (const machine of machines) {
    const normalized = canonicalProvinceValue(machine.provinceCode);
    if (!normalized || normalized === machine.provinceCode) continue;
    try {
      await prisma.machine.update({ where: { id: machine.id }, data: { provinceCode: normalized } });
      updated += 1;
    } catch (error) {
      failed.push({ machineId: machine.id, reason: error instanceof Error ? error.message : "Không chuẩn hóa được tỉnh máy." });
    }
  }
  return { scanned: machines.length, updated, failed };
}

/** Chuẩn hóa đồng bộ mọi cột tỉnh đang dùng để phân quyền / điều phối. */
export async function normalizeStoredProvinceData(limitInput = 1_000) {
  const [users, dealers, machines] = await Promise.all([
    normalizeUserProvinceScopes(limitInput),
    normalizeDealerProvinces(limitInput),
    normalizeMachineProvinceCodes(limitInput),
  ]);
  return {
    users,
    dealers,
    machines,
    updated: users.updated + dealers.updated + machines.updated,
  };
}
