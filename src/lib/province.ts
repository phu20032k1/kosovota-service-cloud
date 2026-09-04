export const PROVINCES = [
  ["01", "HN", "Hà Nội"], ["02", "HG", "Hà Giang"], ["03", "CB", "Cao Bằng"],
  ["04", "BK", "Bắc Kạn"], ["05", "TQ", "Tuyên Quang"], ["06", "LC", "Lào Cai"],
  ["07", "DB", "Điện Biên"], ["08", "LCH", "Lai Châu"], ["09", "SL", "Sơn La"],
  ["10", "YB", "Yên Bái"], ["11", "HB", "Hòa Bình"], ["12", "TN", "Thái Nguyên"],
  ["13", "LS", "Lạng Sơn"], ["14", "QN", "Quảng Ninh"], ["15", "BG", "Bắc Giang"],
  ["16", "PT", "Phú Thọ"], ["17", "VP", "Vĩnh Phúc"], ["18", "BDI", "Bình Định"],
  ["19", "PY", "Phú Yên"], ["20", "KH", "Khánh Hòa"], ["21", "NT", "Ninh Thuận"],
  ["22", "BT", "Bình Thuận"], ["23", "KT", "Kon Tum"], ["24", "GL", "Gia Lai"],
  ["25", "DL", "Đắk Lắk"], ["26", "DN", "Đắk Nông"], ["27", "LD", "Lâm Đồng"],
  ["28", "BP", "Bình Phước"], ["29", "TNI", "Tây Ninh"], ["30", "BD", "Bình Dương"],
  ["31", "DNA", "Đồng Nai"], ["32", "VT", "Bà Rịa - Vũng Tàu"],
  ["33", "HCM", "Hồ Chí Minh"], ["34", "CM", "Cà Mau"],
] as const;

type ProvinceRow = (typeof PROVINCES)[number];

export function normalizeProvinceValue(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase()
    .replace(/\b(tinh|thanh pho|tp)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findProvince(value?: string | null): ProvinceRow | null {
  const normalized = normalizeProvinceValue(value);
  if (!normalized) return null;
  return PROVINCES.find((item) => item.some((part) => normalizeProvinceValue(String(part)) === normalized)) || null;
}

export function provinceLetterCode(value?: string | null) {
  return findProvince(value)?.[1] || "HN";
}

export function provinceLetterCodeOrNull(value?: string | null) {
  return findProvince(value)?.[1] || null;
}

export function provinceName(value?: string | null) {
  return findProvince(value)?.[2] || null;
}

function splitScope(scope?: string | null | readonly string[]) {
  const values = Array.isArray(scope) ? scope : String(scope || "").split(/[,;|\n]+/);
  return values.map((value) => String(value).trim()).filter(Boolean);
}

/**
 * Mở rộng phạm vi tỉnh sang đủ 3 alias đang tồn tại trong dữ liệu cũ:
 * tên đầy đủ, mã chữ và mã số. Giá trị lạ vẫn được giữ để không làm mất quyền cũ.
 */
export function expandProvinceScope(scope?: string | null | readonly string[]) {
  const expanded = new Set<string>();
  for (const raw of splitScope(scope)) {
    const row = findProvince(raw);
    if (row) row.forEach((part) => expanded.add(String(part)));
    else expanded.add(raw);
  }
  return [...expanded];
}

export function provinceNamesForScope(scope?: string | null | readonly string[]) {
  const names = new Set<string>();
  for (const raw of splitScope(scope)) {
    const row = findProvince(raw);
    if (row) names.add(row[2]);
  }
  return [...names];
}

/** Nhận diện tỉnh từ địa chỉ theo tên đầy đủ, tránh hiểu nhầm số nhà thành mã tỉnh. */
export function provinceFromAddress(address?: string | null) {
  const normalized = normalizeProvinceValue(address);
  if (!normalized) return null;
  const padded = ` ${normalized} `;
  const matches = PROVINCES
    .map((row) => ({ row, name: normalizeProvinceValue(row[2]) }))
    .filter(({ name }) => padded.includes(` ${name} `))
    .sort((a, b) => b.name.length - a.name.length);
  return matches[0]?.row || null;
}

export function addressWithProvince(address: string, province?: string | null) {
  const clean = address.trim();
  const row = findProvince(province);
  if (!clean || !row) return clean;
  if (provinceFromAddress(clean)?.[1] === row[1]) return clean;
  return `${clean}, ${row[2]}`;
}

export function isVietnamCoordinates(lat: number, lng: number) {
  // Biên đủ rộng cho đất liền + đảo gần bờ, nhưng chặn kết quả geocode ở quốc gia khác.
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 7.5 && lat <= 24.5 && lng >= 101.0 && lng <= 111.5;
}
