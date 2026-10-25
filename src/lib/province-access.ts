import { findProvince, normalizeProvinceValue, provinceFromAddress } from "@/lib/province";

function splitScope(scope?: string | null | readonly string[]) {
  const values = Array.isArray(scope) ? scope : String(scope || "").split(/[,;|\n]+/);
  return values.map((value) => String(value).trim()).filter(Boolean);
}

function normalizeText(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\b(phuong|p\.?|xa|x\.?|thi tran|tt\.?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  const rawCandidate = canonicalProvince(provinceValue);
  return Boolean(rawCandidate && scopeItems.some((item) => canonicalProvince(item) === rawCandidate));
}

/**
 * Phạm vi xã/phường dùng chuỗi phân cách bằng dấu phẩy/chấm phẩy/xuống dòng.
 * So khớp không dấu và bỏ tiền tố Phường/Xã/Thị trấn để dữ liệu địa chỉ legacy vẫn dùng được.
 * Nếu đã cấu hình wardScope nhưng khách hàng không có địa chỉ thì mặc định từ chối.
 */
export function wardScopeAllows(scope?: string | null | readonly string[], address?: string | null) {
  const scopeItems = splitScope(scope).map(normalizeText).filter(Boolean);
  if (!scopeItems.length) return true;
  const normalizedAddress = normalizeText(address);
  if (!normalizedAddress) return false;
  return scopeItems.some((item) => normalizedAddress.includes(item));
}

/**
 * customerScope chứa các mã khách hàng cụ thể. Khi scope được cấu hình phải khớp chính xác ID.
 */
export function customerScopeAllows(scope?: string | null | readonly string[], customerId?: string | null) {
  const scopeItems = splitScope(scope).map((item) => item.toLowerCase());
  if (!scopeItems.length) return true;
  const candidate = String(customerId || "").trim().toLowerCase();
  return Boolean(candidate && scopeItems.includes(candidate));
}

export type CskhScope = {
  provinceScope?: string | null;
  wardScope?: string | null;
  customerScope?: string | null;
};

/**
 * Các scope đã cấu hình được áp dụng đồng thời (AND). Scope rỗng giữ tương thích dữ liệu cũ.
 */
export function cskhScopeAllows(
  scope: CskhScope,
  input: { provinceValue?: string | null; address?: string | null; customerId?: string | null },
) {
  return provinceScopeAllows(scope.provinceScope, input.provinceValue, input.address)
    && wardScopeAllows(scope.wardScope, input.address)
    && customerScopeAllows(scope.customerScope, input.customerId);
}
