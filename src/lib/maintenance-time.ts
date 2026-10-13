const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

/**
 * Lịch bảo trì trong KOSOVOTA là lịch theo ngày, không phải deadline theo giờ.
 * Khi người dùng chọn "hôm nay", hệ thống phải coi toàn bộ ngày Việt Nam là đến hạn
 * thay vì chỉ lấy đúng thời điểm hiện tại (có thể làm mốc 12:00 bị bỏ sót buổi sáng).
 */
export function endOfVietnamCalendarDay(input: Date) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) throw new Error("Mốc thời gian không hợp lệ.");

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const part = (type: "year" | "month" | "day") =>
    parts.find((item) => item.type === type)?.value || "";

  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) throw new Error("Không xác định được ngày Việt Nam.");

  // Việt Nam dùng UTC+07 quanh năm và không có DST.
  return new Date(`${year}-${month}-${day}T23:59:59.999+07:00`);
}
