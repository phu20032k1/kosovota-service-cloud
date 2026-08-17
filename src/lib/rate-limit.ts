import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";

type Bucket = { count: number; resetAt: number };
type RateLimitOptions = { namespace: string; limit: number; windowMs: number; identifier?: string };

const globalRateLimit = globalThis as unknown as { kosovotaRateLimit?: Map<string, Bucket> };
const buckets = globalRateLimit.kosovotaRateLimit ?? new Map<string, Bucket>();
if (!globalRateLimit.kosovotaRateLimit) globalRateLimit.kosovotaRateLimit = buckets;

function requestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function identityFor(request: NextRequest, options: RateLimitOptions) {
  return options.identifier?.trim() || requestIp(request);
}

export function checkRateLimit(request: NextRequest, options: RateLimitOptions) {
  const now = Date.now();
  const identity = identityFor(request, options);
  const key = `${options.namespace}:${identity}`;
  const existing = buckets.get(key);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + options.windowMs }
    : existing;

  bucket.count += 1;
  buckets.set(key, bucket);

  if (buckets.size > 10_000) {
    for (const [storedKey, stored] of buckets) {
      if (stored.resetAt <= now) buckets.delete(storedKey);
    }
  }

  return {
    allowed: bucket.count <= options.limit,
    remaining: Math.max(0, options.limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    source: "memory" as const,
  };
}

export async function checkDistributedRateLimit(request: NextRequest, options: RateLimitOptions) {
  const redis = getRedis();
  if (!redis) return checkRateLimit(request, options);

  const now = Date.now();
  const windowMs = Math.max(1_000, options.windowMs);
  const windowId = Math.floor(now / windowMs);
  const resetAt = (windowId + 1) * windowMs;
  const identity = identityFor(request, options);
  const identityHash = createHash("sha256").update(identity).digest("hex").slice(0, 24);
  const key = `kosovota:rate:${options.namespace}:${windowId}:${identityHash}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, Math.ceil(windowMs / 1000) + 5);
    }

    return {
      allowed: count <= options.limit,
      remaining: Math.max(0, options.limit - count),
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      source: "redis" as const,
    };
  } catch (error) {
    console.warn("Redis rate limit failed; falling back to memory", error);
    return checkRateLimit(request, options);
  }
}
