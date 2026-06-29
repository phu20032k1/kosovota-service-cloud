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

export function provinceLetterCode(value?: string | null) {
  const normalized = (value || "").trim().toLowerCase();
  const row = PROVINCES.find((item) =>
    item.some((part) => String(part).toLowerCase() === normalized),
  );
  return row?.[1] || "HN";
}
