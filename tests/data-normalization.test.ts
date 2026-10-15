import assert from "node:assert/strict";
import test from "node:test";
import { canonicalProvinceScope, canonicalProvinceValue } from "../src/lib/data-normalization";

test("canonicalProvinceValue normalizes numeric codes, letter codes and names", () => {
  assert.equal(canonicalProvinceValue("01"), "HN");
  assert.equal(canonicalProvinceValue("HN"), "HN");
  assert.equal(canonicalProvinceValue("Hà Nội"), "HN");
  assert.equal(canonicalProvinceValue("33"), "HCM");
  assert.equal(canonicalProvinceValue("Hồ Chí Minh"), "HCM");
});

test("canonicalProvinceValue preserves unknown historical values", () => {
  assert.equal(canonicalProvinceValue("LEGACY-X"), "LEGACY-X");
  assert.equal(canonicalProvinceValue(null), null);
});

test("canonicalProvinceScope normalizes numeric codes, letter codes and names", () => {
  assert.equal(canonicalProvinceScope("01, Hồ Chí Minh, DDN"), "HN,HCM,DDN");
});

test("canonicalProvinceScope removes duplicates but preserves unknown historical tokens", () => {
  assert.equal(canonicalProvinceScope("HN; Hà Nội;LEGACY-X"), "HN,LEGACY-X");
  assert.equal(canonicalProvinceScope(null), null);
});
