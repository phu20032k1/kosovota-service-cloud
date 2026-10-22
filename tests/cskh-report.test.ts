import test from "node:test";
import assert from "node:assert/strict";
import { CARE_RESULT_OPTIONS, careLabelStatus, careStatusLabel, monthsBetween, serviceResultLabel, splitVietnamAddress } from "../src/lib/cskh-report";

test("all six IIPMAP care results map both ways", () => {
  assert.equal(CARE_RESULT_OPTIONS.length, 6);
  for (const option of CARE_RESULT_OPTIONS) {
    assert.equal(careStatusLabel(option.status), option.label);
    assert.equal(careLabelStatus(option.label), option.status);
  }
});

test("monthsBetween returns completed calendar months", () => {
  assert.equal(monthsBetween("2025-01-15", "2026-07-14"), 17);
  assert.equal(monthsBetween("2025-01-15", "2026-07-15"), 18);
});

test("Vietnam address separates ward and street while removing province", () => {
  assert.deepEqual(
    splitVietnamAddress("12 Trần Hưng Đạo, Phường Cửa Nam, Hà Nội", "Hà Nội"),
    { ward: "Phường Cửa Nam", street: "12 Trần Hưng Đạo" },
  );
});

test("service result prefers dealer report", () => {
  assert.equal(serviceResultLabel({ status: "COMPLETED", reportServiceType: "Thay lõi 123", products: "Lõi 1, 2, 3" }), "Thay lõi 123 · Lõi 1, 2, 3");
  assert.equal(serviceResultLabel({ status: "ASSIGNED", dealerCode: "DL001" }), "Đã giao DL001");
});
