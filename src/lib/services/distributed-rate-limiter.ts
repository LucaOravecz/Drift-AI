import "server-only";

import type { RateLimitResult } from "./security-hardening.service";
import { RateLimiter } from "./security-hardening.service";

type UpstashRatelimit = import("@upstash/ratelimit").Ratelimit;

let memoized: UpstashRatelimit | null | undefined;

async function getDistributedLimiter(): Promise<UpstashRatelimit | null> {
  if (memoized !== undefined) return memoized;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    memoized = null;
    return null;
  }

  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    memoized = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(200, "60 s"),
      prefix: "drift:rl",
    });
  } catch {
    memoized = null;
  }

  return memoized ?? null;
}

/**
 * Cross-instance rate limit when Upstash is configured; otherwise in-memory sliding window.
 * API keys keep per-key limits via {@link RateLimiter.checkByApiKey} (see ApiKeyService).
 */
export async function limitByUser(userId: string, maxPerMinute = 200): Promise<RateLimitResult> {
  const limiter = await getDistributedLimiter();
  if (limiter) {
    const res = await limiter.limit(`user:${userId}`);
    return {
      allowed: res.success,
      remaining: res.remaining,
      resetAt: res.reset,
    };
  }
  return RateLimiter.checkByUser(userId, maxPerMinute);
}
