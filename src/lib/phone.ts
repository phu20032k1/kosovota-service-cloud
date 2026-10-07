export function normalizePhone(phone: string): string {
  const raw = String(phone || "").trim();

  // Dữ liệu CRM/Excel thường chứa nhiều số trong cùng một ô, kèm tên người liên hệ,
  // dấu chấm/gạch chéo/gạch ngang hoặc hậu tố như "-1". Ưu tiên lấy số di động
  // Việt Nam hợp lệ đầu tiên thay vì nối toàn bộ chữ số trong ô thành một chuỗi sai.
  for (const match of raw.matchAll(/(?:^|[^\d])((?:\+?84|0)?[35789](?:[\s().-]?\d){8})(?!\d)/g)) {
    const candidate = match[1].replace(/\D/g, "");
    if (candidate.startsWith("84") && candidate.length === 11) {
      return `0${candidate.slice(2)}`;
    }
    if (/^0[35789]\d{8}$/.test(candidate)) {
      return candidate;
    }
    if (/^[35789]\d{8}$/.test(candidate)) {
      return `0${candidate}`;
    }
  }

  const digits = raw.replace(/\D/g, "");

  if (digits.startsWith("84") && digits.length === 11) {
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
