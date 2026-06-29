export function normalizePhone(phone: string): string {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "");

  if (digits.startsWith("84")) {
    return "0" + digits.slice(2);
  }

  return digits;
}

export function isValidVietnamPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^0\d{9}$/.test(normalized);
}