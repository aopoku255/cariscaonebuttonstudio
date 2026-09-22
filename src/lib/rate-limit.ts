import "server-only";

/**
 * A small fixed-window rate limiter held in process memory.
 *
 * This is deliberately simple and is the right shape for a single-instance
 * deployment, which is what this studio runs. If the app is ever scaled to several
 * instances behind a load balancer, replace the `buckets` map with Redis or another
 * shared store: the exported API is designed so that swap touches only this file.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Drop expired buckets so the map cannot grow without bound. */
function sweep(now: number): void {
  if (buckets.size < 2000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  options: { limit: number; windowSeconds: number },
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowSeconds * 1000 });
    return { ok: true, remaining: options.limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;

  if (bucket.count > options.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return {
    ok: true,
    remaining: options.limit - bucket.count,
    retryAfterSeconds: 0,
  };
}

/** Limits tuned per surface. Login is the strictest, since it guards credentials. */
export const RATE_LIMITS = {
  adminLogin: { limit: 8, windowSeconds: 15 * 60 },
  customerLogin: { limit: 10, windowSeconds: 15 * 60 },
  createBooking: { limit: 12, windowSeconds: 10 * 60 },
  quote: { limit: 120, windowSeconds: 60 },
  availability: { limit: 180, windowSeconds: 60 },
  corporateInquiry: { limit: 5, windowSeconds: 60 * 60 },
} as const;

/** Clear all state. Test helper only. */
export function resetRateLimits(): void {
  buckets.clear();
}
