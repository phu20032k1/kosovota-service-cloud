import { formatSequence, nextSequence } from "@/lib/id-sequence";

export async function createOrderCode(provinceCode = "01") {
  const year = String(new Date().getFullYear()).slice(-2);
  const key = `SERVICE_ORDER:${year}`;
  const sequence = await nextSequence(key);
  return `TK-${provinceCode.padStart(2, "0")}-${year}-${formatSequence(sequence, 6)}`;
}
