import assert from "node:assert/strict";
import test from "node:test";
import { cskhScopeAllows, customerScopeAllows, effectiveProvinceCode, provinceScopeAllows, wardScopeAllows } from "@/lib/province-access";

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

test("ward scope so khớp không dấu và bỏ tiền tố xã phường", () => {
  assert.equal(wardScopeAllows("Phường Dịch Vọng", "12 Trần Thái Tông, P. Dịch Vọng, Cầu Giấy, Hà Nội"), true);
  assert.equal(wardScopeAllows("Mai Dịch", "12 Trần Thái Tông, Phường Dịch Vọng, Cầu Giấy, Hà Nội"), false);
  assert.equal(wardScopeAllows("Dịch Vọng", null), false);
});

test("customer scope chỉ cho đúng mã khách hàng", () => {
  assert.equal(customerScopeAllows("cus-01,cus-02", "CUS-02"), true);
  assert.equal(customerScopeAllows("cus-01,cus-02", "cus-03"), false);
  assert.equal(customerScopeAllows(null, "cus-03"), true);
});

test("các scope đã cấu hình áp dụng đồng thời", () => {
  const scope = { provinceScope: "HN", wardScope: "Dịch Vọng", customerScope: "CUS-01" };
  assert.equal(cskhScopeAllows(scope, { provinceValue: "HN", address: "Dịch Vọng, Cầu Giấy, Hà Nội", customerId: "CUS-01" }), true);
  assert.equal(cskhScopeAllows(scope, { provinceValue: "HN", address: "Mai Dịch, Cầu Giấy, Hà Nội", customerId: "CUS-01" }), false);
  assert.equal(cskhScopeAllows(scope, { provinceValue: "HN", address: "Dịch Vọng, Cầu Giấy, Hà Nội", customerId: "CUS-02" }), false);
  assert.equal(cskhScopeAllows(scope, { provinceValue: "HCM", address: "Dịch Vọng, Cầu Giấy, Hà Nội", customerId: "CUS-01" }), false);
});
