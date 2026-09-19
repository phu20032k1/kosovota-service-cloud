/**
 * Danh mục tương thích dữ liệu KOSOVOTA cũ (mã số 01..34) và đầy đủ 63
 * tỉnh/thành trước sắp xếp 2025. Mã chữ là mã nghiệp vụ ổn định dùng trên máy.
 * Tên cũ vẫn được giữ làm alias để dữ liệu lịch sử và địa chỉ khách hàng không mất.
 */
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
  ["AG", "AG", "An Giang"], ["BL", "BL", "Bạc Liêu"], ["BN", "BN", "Bắc Ninh"],
  ["BTR", "BTR", "Bến Tre"], ["CT", "CT", "Cần Thơ"], ["DDN", "DDN", "Đà Nẵng"],
  ["DT", "DT", "Đồng Tháp"], ["HNA", "HNA", "Hà Nam"], ["HT", "HT", "Hà Tĩnh"],
  ["HD", "HD", "Hải Dương"], ["HP", "HP", "Hải Phòng"], ["HGI", "HGI", "Hậu Giang"],
  ["HY", "HY", "Hưng Yên"], ["KG", "KG", "Kiên Giang"], ["LA", "LA", "Long An"],
  ["ND", "ND", "Nam Định"], ["NA", "NA", "Nghệ An"], ["NB", "NB", "Ninh Bình"],
  ["QB", "QB", "Quảng Bình"], ["QNA", "QNA", "Quảng Nam"], ["QNG", "QNG", "Quảng Ngãi"],
  ["QT", "QT", "Quảng Trị"], ["ST", "ST", "Sóc Trăng"], ["TB", "TB", "Thái Bình"],
  ["TH", "TH", "Thanh Hóa"], ["TTH", "TTH", "Thừa Thiên Huế"], ["TG", "TG", "Tiền Giang"],
  ["TV", "TV", "Trà Vinh"], ["VL", "VL", "Vĩnh Long"],
] as const;

type ProvinceRow = (typeof PROVINCES)[number];

const EXTRA_ALIASES: Record<string, string> = {
  "tp hcm": "HCM",
  "tp ho chi minh": "HCM",
  "thanh pho ho chi minh": "HCM",
  "sai gon": "HCM",
  "ba ria vung tau": "VT",
  "thua thien hue": "TTH",
  "thanh pho hue": "TTH",
  "hue": "TTH",
  "da nang": "DDN",
  "can tho": "CT",
  "hai phong": "HP",
};

export const PROVINCE_CHOICES = PROVINCES
  .map(([, code, name]) => ({ code, name }))
  .filter((item, index, rows) => rows.findIndex((row) => row.code === item.code) === index)
  .sort((left, right) => left.name.localeCompare(right.name, "vi"));

export const PROVINCE_CODES = PROVINCE_CHOICES.map((item) => item.code);

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
  const aliasCode = EXTRA_ALIASES[normalized];
  if (aliasCode) return PROVINCES.find((item) => item[1] === aliasCode) || null;
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

/** Mở rộng scope sang tên đầy đủ, mã chữ và mã số tương thích dữ liệu cũ. */
export function expandProvinceScope(scope?: string | null | readonly string[]) {
  const expanded = new Set<string>();
  for (const raw of splitScope(scope)) {
    const row = findProvince(raw);
    if (row) row.forEach((part) => part && expanded.add(String(part)));
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

/** Nhận diện tỉnh từ chuỗi địa chỉ hoặc địa chỉ chuẩn hóa của nhà cung cấp bản đồ. */
export function provinceFromAddress(address?: string | null) {
  const normalized = normalizeProvinceValue(address);
  if (!normalized) return null;
  const padded = ` ${normalized} `;
  const aliases = [
    ...PROVINCES.map((row) => ({ row, name: normalizeProvinceValue(row[2]) })),
    ...Object.entries(EXTRA_ALIASES).map(([name, code]) => ({ row: PROVINCES.find((item) => item[1] === code)!, name })),
  ].filter((entry) => entry.row && entry.name);
  return aliases
    .filter(({ name }) => padded.includes(` ${name} `))
    .sort((a, b) => b.name.length - a.name.length)[0]?.row || null;
}

export function addressWithProvince(address: string, province?: string | null) {
  const clean = address.trim();
  const row = findProvince(province);
  if (!clean || !row) return clean;
  if (provinceFromAddress(clean)?.[1] === row[1]) return clean;
  return `${clean}, ${row[2]}`;
}

export function isVietnamCoordinates(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 7.5 && lat <= 24.5 && lng >= 101.0 && lng <= 111.5;
}
