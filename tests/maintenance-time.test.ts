import assert from "node:assert/strict";
import test from "node:test";
import { endOfVietnamCalendarDay } from "@/lib/maintenance-time";

test("mốc sinh lệnh bao trọn ngày hiện tại tại Việt Nam", () => {
  // 03:15 UTC = 10:15 tại Việt Nam. Lịch chỉnh về 12:00 Việt Nam cùng ngày
  // phải được coi là đã đến hạn ngay khi Admin bấm Tạo lệnh đến hạn.
  const now = new Date("2026-10-14T03:15:00.000Z");
  const cutoff = endOfVietnamCalendarDay(now);
  const dueAtNoonVietnam = new Date("2026-10-14T12:00:00+07:00");

  assert.equal(cutoff.toISOString(), "2026-10-14T16:59:59.999Z");
  assert.ok(dueAtNoonVietnam <= cutoff);
});

test("mốc gần nửa đêm UTC vẫn dùng đúng ngày lịch Việt Nam", () => {
  // 18:30 UTC ngày 13/10 đã là 01:30 ngày 14/10 tại Việt Nam.
  const cutoff = endOfVietnamCalendarDay(new Date("2026-10-13T18:30:00.000Z"));
  assert.equal(cutoff.toISOString(), "2026-10-14T16:59:59.999Z");
});

test("cron buổi sáng Việt Nam vẫn sinh mọi lệnh của ngày hiện tại", () => {
  // 23:45 UTC ngày 14/10 = 06:45 ngày 15/10 tại Việt Nam. Trước đây cron dùng
  // đúng timestamp này nên một lịch lưu giữa ngày 15/10 có thể bị bỏ sót tới hôm sau.
  const cronRun = new Date("2026-10-14T23:45:00.000Z");
  const cutoff = endOfVietnamCalendarDay(cronRun);
  const storedCalendarDate = new Date("2026-10-15T12:00:00.000Z");

  assert.equal(cutoff.toISOString(), "2026-10-15T16:59:59.999Z");
  assert.ok(storedCalendarDate <= cutoff);
});
