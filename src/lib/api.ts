import { NextResponse } from "next/server";

export type JsonRecord = Record<string, unknown>;

export function jsonError(message: string, status = 400, detail?: unknown) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...(process.env.NODE_ENV !== "production" && detail
        ? { detail: detail instanceof Error ? detail.message : String(detail) }
        : {}),
    },
    { status },
  );
}

export function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readOptionalString(value: unknown) {
  const result = readString(value);
  return result || null;
}

export function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parseDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = readString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function readJson(request: Request): Promise<JsonRecord | null> {
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonRecord)
      : null;
  } catch {
    return null;
  }
}
