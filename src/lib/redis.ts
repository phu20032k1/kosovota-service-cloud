import { Redis } from "@upstash/redis";

let redis: Redis | null | undefined;

const DEALER_CACHE_VERSION_KEY = "kosovota:cache:dealers:version";

export function getRedis() {
  if (redis !== undefined) return redis;

  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    redis = null;
    return redis;
  }

  redis = new Redis({ url, token });
  return redis;
}

export async function redisGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;

  try {
    return await client.get<T>(key);
  } catch (error) {
    console.warn(`Redis GET failed for ${key}`, error);
    return null;
  }
}

export async function redisSet<T>(key: string, value: T, ttlSeconds: number) {
  const client = getRedis();
  if (!client) return false;

  try {
    await client.set(key, value, { ex: ttlSeconds });
    return true;
  } catch (error) {
    console.warn(`Redis SET failed for ${key}`, error);
    return false;
  }
}

export async function getDealerCacheVersion() {
  const client = getRedis();
  if (!client) return 0;

  try {
    const current = await client.get<number | string>(DEALER_CACHE_VERSION_KEY);
    const parsed = Number(current);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (error) {
    console.warn("Redis dealer cache version read failed", error);
    return 0;
  }
}

export async function bumpDealerCacheVersion() {
  const client = getRedis();
  if (!client) return 0;

  try {
    return await client.incr(DEALER_CACHE_VERSION_KEY);
  } catch (error) {
    console.warn("Redis dealer cache invalidation failed", error);
    return 0;
  }
}

export function cachePart(value: string, fallback = "all") {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized || fallback;
}
