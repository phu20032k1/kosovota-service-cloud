import assert from "node:assert/strict";
import test from "node:test";
import { buildMaintenanceSchedules, getMaintenanceTemplates } from "@/lib/maintenance";
import {
  PROVINCE_CHOICES,
  expandProvinceScope,
  findProvince,
  provinceFromAddress,
  provinceLetterCodeOrNull,
} from "@/lib/province";

test("model chưa cấu hình vẫn có lịch chăm sóc và bảo trì mặc định", () => {
  const templates = getMaintenanceTemplates("MODEL_MOI_CHUA_CAU_HINH");
  assert.equal(templates.length, 6);
  assert.equal(templates[0].daysAfterInstallation, 4);

  const installedAt = new Date("2026-03-10T05:00:00.000Z");
  const schedules = buildMaintenanceSchedules("KSV-TEST", installedAt, "MODEL_MOI_CHUA_CAU_HINH");
  assert.equal(schedules.length, 6);
  assert.equal(schedules[0].machineId, "KSV-TEST");
  assert.ok(schedules.every((schedule) => schedule.status === "PENDING"));
  assert.ok(schedules.every((schedule) => schedule.dueDate > installedAt));
});

test("model đã cấu hình giữ đúng chu kỳ riêng", () => {
  const templates = getMaintenanceTemplates("RO_UNDER_30");
  assert.ok(templates.length > 6);
  assert.ok(templates.some((template) => template.title.includes("màng RO")));
});

test("danh mục có đủ 63 tỉnh/thành lịch sử và các thành phố bị thiếu", () => {
  assert.equal(PROVINCE_CHOICES.length, 63);
  assert.equal(findProvince("Hải Phòng")?.[1], "HP");
  assert.equal(findProvince("Cần Thơ")?.[1], "CT");
  assert.equal(findProvince("Đà Nẵng")?.[1], "DDN");
});

test("nhận diện tỉnh từ địa chỉ, mã số cũ và scope", () => {
  assert.equal(provinceFromAddress("12 Lạch Tray, Ngô Quyền, TP Hải Phòng")?.[1], "HP");
  assert.equal(provinceFromAddress("Ninh Kiều, Cần Thơ")?.[1], "CT");
  assert.equal(provinceLetterCodeOrNull("33"), "HCM");
  assert.deepEqual(expandProvinceScope("HP"), ["HP", "Hải Phòng"]);
});
