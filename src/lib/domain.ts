import { PROVINCES as PROVINCE_ROWS } from "@/lib/province";

/** Dùng chung một nguồn tỉnh/thành để mã máy, đăng ký và bản đồ không lệch nhau. */
export const PROVINCES = PROVINCE_ROWS.map(([number, code, name]) => ({ number, name, code }));

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
