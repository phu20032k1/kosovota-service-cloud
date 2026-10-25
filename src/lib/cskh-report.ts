export const CARE_RESULT_OPTIONS = [
  { label: "KH tiếp nhận CS + dịch vụ", status: "CUSTOMER_ACCEPTED" },
  { label: "KH Nội bộ công ty", status: "CUSTOMER_INTERNAL" },
  { label: "KH tiếp nhận CS - tự thay", status: "CUSTOMER_SELF_SERVICE" },
  { label: "KH từ chối chăm sóc", status: "CUSTOMER_REJECTED" },
  { label: "KH không liên lạc được", status: "CALLED_NO_ANSWER" },
  { label: "KH khó liên lạc - Dịch vụ", status: "RESCHEDULED" },
] as const;

export const SERVICE_WORK_OPTIONS = [
  "Lắp đặt mới",
  "Thay lõi số 1",
  "Thay lõi 123",
  "Thay toàn bộ lõi và màng RO",
  "Thay lõi 123 và T33",
  "Sửa chữa",
  "Thay vật liệu lọc thô",
] as const;

const CARE_STATUS_TO_LABEL = new Map<string, string>(CARE_RESULT_OPTIONS.map((item) => [item.status, item.label] as const));
const CARE_LABEL_TO_STATUS = new Map<string, string>(CARE_RESULT_OPTIONS.map((item) => [item.label, item.status]));

export function careStatusLabel(status?: string | null) {
  return status ? CARE_STATUS_TO_LABEL.get(status) || "" : "";
}

export function careLabelStatus(label?: string | null) {
  return label ? CARE_LABEL_TO_STATUS.get(label) || "" : "";
}

export function monthsBetween(from?: string | Date | null, to: string | Date = new Date()) {
  if (!from) return null;
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase().trim();
}

export function splitVietnamAddress(address?: string | null, provinceName?: string | null) {
  const parts = String(address || "").split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return { ward: "", street: "" };
  const province = normalized(provinceName || "");
  const withoutProvince = parts.filter((part) => !province || normalized(part) !== province);
  const wardIndex = withoutProvince.findIndex((part) => /\b(phường|phuong|xã|xa|thị trấn|thi tran)\b/i.test(normalized(part)));
  const ward = wardIndex >= 0 ? withoutProvince[wardIndex] : "";
  const streetParts = withoutProvince.filter((_, index) => index !== wardIndex);
  return { ward, street: streetParts.join(", ") };
}

export function serviceResultLabel(input: { status?: string | null; reportServiceType?: string | null; products?: string | null; dealerCode?: string | null }) {
  if (input.status === "COMPLETED") return "Đã hoàn thành";
  if (input.reportServiceType) return [input.reportServiceType, input.products].filter(Boolean).join(" · ");
  if (["IN_PROGRESS", "ACCEPTED"].includes(input.status || "")) return "Đại lý đang thực hiện";
  if (input.status === "ASSIGNED") return input.dealerCode ? `Đã giao ${input.dealerCode}` : "Đã giao đại lý";
  if (input.status === "CANCELLED") return "Đã hủy";
  return "Chưa có kết quả dịch vụ";
}
