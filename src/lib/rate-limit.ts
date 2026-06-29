import type { NextRequest } from "next/server";

type Bucket = { count: number; resetAt: number };
type RateLimitOptions = { namespace: string; limit: number; windowMs: number; identifier?: string };

const globalRateLimit = globalThis as unknown as { kosovotaRateLimit?: Map<string, Bucket> };
const buckets = globalRateLimit.kosovotaRateLimit ?? new Map<string, Bucket>();
if (!globalRateLimit.kosovotaRateLimit) globalRateLimit.kosovotaRateLimit = buckets;

function requestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function checkRateLimit(request: NextRequest, options: RateLimitOptions) {
  const now = Date.now();
  const identity = options.identifier?.trim() || requestIp(request);
  const key = `${options.namespace}:${identity}`;
  const existing = buckets.get(key);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + options.windowMs }
    : existing;

  bucket.count += 1;
  buckets.set(key, bucket);

  // Keep memory bounded in long-running Node servers.
  if (buckets.size > 10_000) {
    for (const [storedKey, stored] of buckets) {
      if (stored.resetAt <= now) buckets.delete(storedKey);
    }
  }

  return {
    allowed: bucket.count <= options.limit,
    remaining: Math.max(0, options.limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}
