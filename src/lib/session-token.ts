import { isInternalRole, type InternalRole } from "@/lib/access-control";

export type SessionPayload = {
  sub: string;
  phone: string;
  name: string;
  role: InternalRole | "CUSTOMER_PORTAL" | "RESET";
  dealerCode?: string | null;
  provinceScope?: string | null;
  purpose?: string;
  iat: number;
  exp: number;
};

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeJson(value: unknown) {
  return bytesToBase64Url(encoder.encode(JSON.stringify(value)));
}

function decodeJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as T;
}

async function hmac(input: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input));
  return bytesToBase64Url(new Uint8Array(signature));
}

function sessionSecret() {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV !== "production") return "kosovota-local-session-secret-change-before-deploy";
  throw new Error("Thiếu SESSION_SECRET trong môi trường production");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function createSessionToken(payload: Omit<SessionPayload, "iat" | "exp">, maxAgeSeconds = 60 * 60 * 12) {
  const now = Math.floor(Date.now() / 1000);
  const encoded = encodeJson({ ...payload, iat: now, exp: now + maxAgeSeconds });
  return `${encoded}.${await hmac(encoded, sessionSecret())}`;
}

export async function verifySessionToken(token?: string | null) {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  try {
    const expected = await hmac(encoded, sessionSecret());
    if (!constantTimeEqual(expected, signature)) return null;
    const payload = decodeJson<SessionPayload>(encoded);
    if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!["CUSTOMER_PORTAL", "RESET"].includes(payload.role) && !isInternalRole(payload.role)) return null;
    return payload;
  } catch {
    return null;
  }
}
