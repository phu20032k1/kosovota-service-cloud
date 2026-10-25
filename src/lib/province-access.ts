import { findProvince, normalizeProvinceValue, provinceFromAddress } from "@/lib/province";

function splitScope(scope?: string | null | readonly string[]) {
  const values = Array.isArray(scope) ? scope : String(scope || "").split(/[,;|\n]+/);
  return values.map((value) => String(value).trim()).filter(Boolean);
}

function canonicalProvince(value?: string | null) {
  const row = findProvince(value);
  if (row) return row[1];
  const normalized = normalizeProvinceValue(value);
  return normalized ? normalized.toUpperCase() : null;
}

/**
 * Trả về mã tỉnh nghiệp vụ ổn định (HN, HCM, HP...) từ mã/tên tỉnh của máy,
 * hoặc suy ra từ địa chỉ khách hàng khi dữ liệu legacy chưa có provinceCode.
 */
export function effectiveProvinceCode(provinceValue?: string | null, address?: string | null) {
  return findProvince(provinceValue)?.[1] || provinceFromAddress(address)?.[1] || null;
}

/**
 * Kiểm tra một máy/khách hàng có thuộc phạm vi tỉnh được phân công hay không.
 * Scope rỗng nghĩa là không giới hạn. Hàm hiểu đồng thời mã số cũ, mã chữ và tên tỉnh.
 */
export function provinceScopeAllows(
  scope?: string | null | readonly string[],
  provinceValue?: string | null,
  address?: string | null,
) {
  const scopeItems = splitScope(scope);
  if (!scopeItems.length) return true;

  const candidate = effectiveProvinceCode(provinceValue, address);
  if (candidate) {
    return scopeItems.some((item) => canonicalProvince(item) === candidate);
  }

  // Dữ liệu rất cũ có thể dùng một mã ngoài danh mục. Chỉ cho phép nếu scope
  // và provinceCode cùng một giá trị chuẩn hóa; không mặc định mở quyền.
  const rawCandidate = canonicalProvince(provinceValue);
  return Boolean(rawCandidate && scopeItems.some((item) => canonicalProvince(item) === rawCandidate));
}
