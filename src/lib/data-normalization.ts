import { prisma } from "@/lib/prisma";
import { findProvince } from "@/lib/province";

function splitScope(scope?: string | null) {
  return String(scope || "")
    .split(/[,;|\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Chuẩn hóa phạm vi tỉnh của tài khoản về mã chữ nghiệp vụ (HN, HCM, ...).
 * Giá trị không nhận diện được được giữ nguyên để không làm mất dữ liệu lịch sử.
 */
export function canonicalProvinceScope(scope?: string | null) {
  const values = splitScope(scope);
  if (!values.length) return null;
  const normalized = new Set(
    values.map((value) => findProvince(value)?.[1] || value),
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
