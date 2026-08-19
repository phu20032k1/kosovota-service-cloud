export function normalizePhone(phone: string): string {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "");

  if (digits.startsWith("84")) {
    return "0" + digits.slice(2);
  }

  // Excel thường tự đổi 0912345678 thành số 912345678 và làm mất số 0 đầu.
  // Chỉ khôi phục cho đầu số di động Việt Nam hợp lệ để không biến mọi chuỗi 9 số thành SĐT.
  if (/^[35789]\d{8}$/.test(digits)) {
    return `0${digits}`;
  }

  return digits;
}

export function isValidVietnamPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^0\d{9}$/.test(normalized);
}
