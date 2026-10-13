import assert from "node:assert/strict";
import test from "node:test";
import { canonicalProvinceScope } from "../src/lib/data-normalization";

test("canonicalProvinceScope normalizes numeric codes, letter codes and names", () => {
  assert.equal(canonicalProvinceScope("01, Hồ Chí Minh, DDN"), "HN,HCM,DDN");
});

test("canonicalProvinceScope removes duplicates but preserves unknown historical tokens", () => {
  assert.equal(canonicalProvinceScope("HN; Hà Nội;LEGACY-X"), "HN,LEGACY-X");
  assert.equal(canonicalProvinceScope(null), null);
});
