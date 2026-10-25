import assert from "node:assert/strict";
import test from "node:test";
import { effectiveProvinceCode, provinceScopeAllows } from "@/lib/province-access";

test("province scope hiểu mã số, mã chữ và tên tỉnh như nhau", () => {
  assert.equal(provinceScopeAllows("Hà Nội", "HN"), true);
  assert.equal(provinceScopeAllows("01", "HN"), true);
  assert.equal(provinceScopeAllows("HN", "01"), true);
  assert.equal(provinceScopeAllows("HCM", "HN"), false);
});

test("province scope suy tỉnh từ địa chỉ khi machine.provinceCode trống", () => {
  assert.equal(effectiveProvinceCode(null, "Số 1 Hoàn Kiếm, Hà Nội"), "HN");
  assert.equal(provinceScopeAllows("HN", null, "Số 1 Hoàn Kiếm, Hà Nội"), true);
  assert.equal(provinceScopeAllows("HCM", null, "Số 1 Hoàn Kiếm, Hà Nội"), false);
});

test("scope rỗng không giới hạn nhưng scope có giá trị không mở máy không rõ tỉnh", () => {
  assert.equal(provinceScopeAllows(null, null, null), true);
  assert.equal(provinceScopeAllows("HN", null, null), false);
});
