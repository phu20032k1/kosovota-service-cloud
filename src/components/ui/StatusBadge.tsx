const tones: Record<string, string> = {
  NEW: "badge-blue", ASSIGNED: "badge-violet", IN_PROGRESS: "badge-amber", ACCEPTED: "badge-blue",
  WAITING_CUSTOMER: "badge-slate", RESOLVED: "badge-emerald", CLOSED: "badge-slate", COMPLETED: "badge-emerald",
  CRITICAL: "badge-rose", HIGH: "badge-rose", NORMAL: "badge-blue", LOW: "badge-slate",
  DRAFT: "badge-slate", SUBMITTED: "badge-amber", APPROVED: "badge-blue", PAID: "badge-emerald", REJECTED: "badge-rose",
  PENDING: "badge-amber", ACTIVE: "badge-emerald", CANCELLED: "badge-slate",
  IN: "badge-emerald", OUT: "badge-rose", TRANSFER: "badge-blue", ADJUST_IN: "badge-emerald", ADJUST_OUT: "badge-rose", SERVICE_USE: "badge-violet",
};

const labels: Record<string, string> = {
  NEW: "Mới", ASSIGNED: "Đã giao", IN_PROGRESS: "Đang xử lý", ACCEPTED: "Đã nhận",
  WAITING_CUSTOMER: "Chờ khách hàng", RESOLVED: "Đã xử lý", CLOSED: "Đã đóng", COMPLETED: "Hoàn thành",
  CRITICAL: "Khẩn cấp", HIGH: "Cao", NORMAL: "Bình thường", LOW: "Thấp",
  DRAFT: "Nháp", SUBMITTED: "Chờ duyệt", APPROVED: "Đã duyệt", PAID: "Đã thanh toán", REJECTED: "Từ chối",
  PENDING: "Chờ xử lý", ACTIVE: "Hoạt động", CANCELLED: "Đã hủy",
  IN: "Nhập kho", OUT: "Xuất kho", TRANSFER: "Chuyển kho", ADJUST_IN: "Điều chỉnh tăng", ADJUST_OUT: "Điều chỉnh giảm", SERVICE_USE: "Dùng cho dịch vụ",
};

export function StatusBadge({ value }: { value?: string | null }) {
  const normalized = (value || "UNKNOWN").toUpperCase();
  return <span className={`status-badge ${tones[normalized] || "badge-slate"}`}>{labels[normalized] || value || "—"}</span>;
}
