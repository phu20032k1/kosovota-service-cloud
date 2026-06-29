import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string) {
  if (!stored.startsWith("scrypt$")) {
    return timingSafeEqual(
      Buffer.from(password.padEnd(Math.max(password.length, stored.length))),
      Buffer.from(stored.padEnd(Math.max(password.length, stored.length))),
    );
  }

  const [, salt, expectedHex] = stored.split("$");
  if (!salt || !expectedHex) return false;

  const actual = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(expectedHex, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
