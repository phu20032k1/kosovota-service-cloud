export const SESSION_COOKIE = "kosovota_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 8;

export const USER_ROLES = ["ADMIN", "CSKH", "DEALER", "CUSTOMER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type SessionPayload = {
  sub: string;
  phone: string;
  name: string;
  role: UserRole;
  customerId?: string | null;
  dealerId?: string | null;
  sv: number;
  iat: number;
  exp: number;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (value) {
    if (process.env.NODE_ENV === "production" && value.length < 32) {
      throw new Error("AUTH_SECRET production cần tối thiểu 32 ký tự");
    }
    return value;
  }
  if (process.env.NODE_ENV !== "production") return "kosovota-dev-secret-change-before-deploy";
  throw new Error("Thiếu AUTH_SECRET trong môi trường production");
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeJson(value: unknown) {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson<T>(value: string) {
  return JSON.parse(new TextDecoder().decode(fromBase64Url(value))) as T;
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function constantTimeTextEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function createSessionToken(
  input: Omit<SessionPayload, "iat" | "exp">,
) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    ...input,
    iat: now,
    exp: now + SESSION_DURATION_SECONDS,
  };
  const encoded = encodeJson(payload);
  return `${encoded}.${await hmac(encoded)}`;
}

export async function verifySessionToken(token: string | null | undefined) {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  try {
    const expected = await hmac(encoded);
    if (!constantTimeTextEqual(signature, expected)) return null;

    const payload = decodeJson<SessionPayload>(encoded);
    if (!payload.sub || !USER_ROLES.includes(payload.role)) return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readCookie(header: string | null, name: string) {
  if (!header) return null;
  const item = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!item) return null;
  try {
    return decodeURIComponent(item.slice(name.length + 1));
  } catch {
    return null;
  }
}
