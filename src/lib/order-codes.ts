import { provinceCodeFromNumber, provinceNumberFromMachineId } from "@/lib/domain";

export function orderPrefix(machineId: string, date = new Date()) {
  const provinceNumber = provinceNumberFromMachineId(machineId);
  const provinceCode = provinceCodeFromNumber(provinceNumber);
  const year = String(date.getFullYear()).slice(-2);
  return `TK-${provinceCode}-${year}-`;
}

export function parseSequence(code: string, prefix: string) {
  if (!code.startsWith(prefix)) return 0;
  const parsed = Number(code.slice(prefix.length));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function formatSequentialCode(prefix: string, sequence: number, width = 6) {
  return `${prefix}${String(sequence).padStart(width, "0")}`;
}

export function nextCodeFromExisting(prefix: string, codes: string[], width = 6) {
  const max = codes.reduce((current, code) => Math.max(current, parseSequence(code, prefix)), 0);
  return formatSequentialCode(prefix, max + 1, width);
}

export function dealerPrefix(provinceCode: string, typeCode: string, date = new Date()) {
  const year = String(date.getFullYear()).slice(-2);
  return `${provinceCode}-${typeCode}-${year}-`;
}
