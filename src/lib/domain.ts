export const PROVINCES = [
  { number: "01", name: "Hà Nội", code: "HN" },
  { number: "02", name: "Hà Giang", code: "HG" },
  { number: "03", name: "Cao Bằng", code: "CB" },
  { number: "04", name: "Bắc Kạn", code: "BK" },
  { number: "05", name: "Tuyên Quang", code: "TQ" },
  { number: "06", name: "Lào Cai", code: "LC" },
  { number: "07", name: "Điện Biên", code: "DB" },
  { number: "08", name: "Lai Châu", code: "LCH" },
  { number: "09", name: "Sơn La", code: "SL" },
  { number: "10", name: "Yên Bái", code: "YB" },
  { number: "11", name: "Hòa Bình", code: "HB" },
  { number: "12", name: "Thái Nguyên", code: "TN" },
  { number: "13", name: "Lạng Sơn", code: "LS" },
  { number: "14", name: "Quảng Ninh", code: "QN" },
  { number: "15", name: "Bắc Giang", code: "BG" },
  { number: "16", name: "Phú Thọ", code: "PT" },
  { number: "17", name: "Vĩnh Phúc", code: "VP" },
  { number: "18", name: "Bình Định", code: "BDI" },
  { number: "19", name: "Phú Yên", code: "PY" },
  { number: "20", name: "Khánh Hòa", code: "KH" },
  { number: "21", name: "Ninh Thuận", code: "NT" },
  { number: "22", name: "Bình Thuận", code: "BT" },
  { number: "23", name: "Kon Tum", code: "KT" },
  { number: "24", name: "Gia Lai", code: "GL" },
  { number: "25", name: "Đắk Lắk", code: "DL" },
  { number: "26", name: "Đắk Nông", code: "DN" },
  { number: "27", name: "Lâm Đồng", code: "LD" },
  { number: "28", name: "Bình Phước", code: "BP" },
  { number: "29", name: "Tây Ninh", code: "TNI" },
  { number: "30", name: "Bình Dương", code: "BD" },
  { number: "31", name: "Đồng Nai", code: "DNA" },
  { number: "32", name: "Bà Rịa - Vũng Tàu", code: "VT" },
  { number: "33", name: "Hồ Chí Minh", code: "HCM" },
  { number: "34", name: "Cà Mau", code: "CM" },
] as const;

export const ORDER_STATUSES = [
  "NEW",
  "CALLED_NO_ANSWER",
  "CUSTOMER_ACCEPTED",
  "CUSTOMER_SELF_SERVICE",
  "CUSTOMER_REJECTED",
  "RESCHEDULED",
  "COMPLAINT",
  "ASSIGNED",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const DEALER_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"] as const;
export type DealerStatus = (typeof DEALER_STATUSES)[number];

export function normalizePhone(value: unknown) {
  return typeof value === "string" ? value.replace(/[\s.()+-]/g, "").trim() : "";
}

export function isValidVietnamPhone(value: string) {
  return /^(?:\+?84|0)\d{9,10}$/.test(value);
}

export function provinceNumberFromMachineId(machineId: string) {
  const match = /^KSV-[A-Z0-9]+-(\d{2})-/i.exec(machineId.trim());
  return match?.[1] ?? "01";
}

export function provinceCodeFromNumber(number: string) {
  return PROVINCES.find((province) => province.number === number)?.code ?? "HN";
}

export function sanitizeProvinceCode(value: unknown) {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  const ascii = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Đ/g, "D");
  return ascii.replace(/[^A-Z0-9]/g, "").slice(0, 4) || "HN";
}

export function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

export function splitServices(value: string | null | undefined) {
  return (value ?? "")
    .split(/[,;\n|]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function dealerCanPerform(dealerServices: string | null | undefined, requestedService: string | null | undefined) {
  const requested = (requestedService ?? "").trim().toLowerCase();
  if (!requested) return true;
  const capabilities = splitServices(dealerServices);
  if (capabilities.length === 0) return true;
  return capabilities.some(
    (service) =>
      service.includes(requested) ||
      requested.includes(service) ||
      (requested.includes("sửa") && service.includes("sửa")) ||
      (requested.includes("thay lõi") && service.includes("thay lõi")),
  );
}
