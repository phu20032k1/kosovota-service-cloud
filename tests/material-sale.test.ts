import test from "node:test";
import assert from "node:assert/strict";
import { materialSaleTotal, readMaterialSale, writeMaterialSale, type MaterialSaleOrder } from "../src/lib/material-sale";

test("material sale keeps source service-order marker for deduplication", () => {
  const original = "Tạo từ CSKH [order:abc123]";
  const order: MaterialSaleOrder = {
    status: "CONFIRMED",
    lines: [{ itemId: "i1", sku: "LOI-01", name: "Lõi lọc", unit: "cái", quantity: 3, unitPrice: 85000 }],
    warehouseId: "k1",
    note: "Giao buổi sáng",
    total: 255000,
    updatedAt: "2026-10-19T00:00:00.000Z",
  };
  const serialized = writeMaterialSale(original, order);
  const parsed = readMaterialSale(serialized);
  assert.equal(parsed.summary, original);
  assert.equal(parsed.order.total, 255000);
  assert.equal(parsed.order.lines[0].quantity, 3);
  assert.equal(readMaterialSale(writeMaterialSale(serialized, order)).summary, original);
  assert.equal(serialized.match(/\[material-sale-order\]/g)?.length, 1);
});

test("material sale starts as draft and calculates totals from lines", () => {
  assert.deepEqual(readMaterialSale("Chờ tư vấn").order.lines, []);
  assert.equal(readMaterialSale("Chờ tư vấn").order.status, "DRAFT");
  assert.equal(materialSaleTotal([
    { itemId: "a", sku: "A", name: "A", unit: "cái", quantity: 2, unitPrice: 50000 },
    { itemId: "b", sku: "B", name: "B", unit: "cái", quantity: 1, unitPrice: 120000 },
  ]), 220000);
});
