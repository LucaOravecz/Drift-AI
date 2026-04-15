import "server-only"

import { RateLimiter } from "@/lib/services/security-hardening.service"

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 5

export async function checkRateLimit(identifier: string): Promise<{ allowed: boolean; remainingMs?: number }> {
  const result = RateLimiter.check(`auth:${identifier}`, MAX_ATTEMPTS, WINDOW_MS)

  if (!result.allowed) {
    const remainingMs = Math.max(result.resetAt - Date.now(), 0)
    return { allowed: false, remainingMs }
  }

  return { allowed: true }
}

export async function recordLoginAttempt(identifier: string, success: boolean) {
  if (success) {
    RateLimiter.reset(`auth:${identifier}`)
  }
}
