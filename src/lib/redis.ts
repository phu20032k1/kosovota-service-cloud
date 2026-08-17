import { Redis } from "@upstash/redis";

let redis: Redis | null | undefined;

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
