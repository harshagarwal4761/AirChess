type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function clientIdentifier(request: Request): string {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp) return cfIp.trim();
  const fwd = request.headers.get("X-Forwarded-For");
  if (fwd) return fwd.split(",")[0]?.trim() || "local";
  return "local";
}

/** In-isolate sliding-window rate limiter to protect auth and room-creation endpoints from bursts. */
export function checkRateLimit(
  bucketKey: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { allowed: boolean; retryAfterSec: number } {
  // Prune stale buckets opportunistically to keep memory bounded.
  if (buckets.size > 500) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }
  const existing = buckets.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count++;
  return { allowed: true, retryAfterSec: 0 };
}

export function resetRateLimitsForTest() {
  buckets.clear();
}
