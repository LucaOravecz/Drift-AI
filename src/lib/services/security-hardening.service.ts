import "server-only";

import { headers } from "next/headers";
import prisma from "@/lib/db";

/**
 * Security Hardening Service
 *
 * Provides:
 * - Rate limiting (in-memory sliding window, upgradeable to Redis)
 * - IP allowlisting from org settings
 * - CSRF origin validation
 * - Request metadata extraction
 */

// ---------------------------------------------------------------------------
// Rate Limiting (Sliding Window)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 60_000);
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000).unref?.();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export class RateLimiter {
  /**
   * Check if a request is within rate limits.
   * Uses a sliding window of 1 minute.
   */
  static check(
    key: string,
    limit: number,
    windowMs = 60_000,
  ): RateLimitResult {
    const now = Date.now();
    const entry = rateLimitStore.get(key) ?? { timestamps: [] };

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

    if (entry.timestamps.length >= limit) {
      const oldestInWindow = entry.timestamps[0];
      rateLimitStore.set(key, entry);
      return {
        allowed: false,
        remaining: 0,
        resetAt: oldestInWindow + windowMs,
      };
    }

    entry.timestamps.push(now);
    rateLimitStore.set(key, entry);

    return {
      allowed: true,
      remaining: limit - entry.timestamps.length,
      resetAt: now + windowMs,
    };
  }

  /**
   * Rate limit by IP address.
   */
  static async checkByIp(limit = 100): Promise<RateLimitResult> {
    const ip = await getRequestIp();
    return this.check(`ip:${ip}`, limit);
  }

  /**
   * Rate limit by user ID.
   */
  static checkByUser(userId: string, limit = 200): RateLimitResult {
    return this.check(`user:${userId}`, limit);
  }

  /**
   * Rate limit by API key.
   */
  static checkByApiKey(keyPrefix: string, limit = 100): RateLimitResult {
    return this.check(`apikey:${keyPrefix}`, limit);
  }
}

// ---------------------------------------------------------------------------
// IP Allowlisting
// ---------------------------------------------------------------------------

export class IpAllowlist {
  /**
   * Check if the requesting IP is allowed for the given organization.
   * If no allowlist is configured, all IPs are allowed.
   */
  static async isAllowed(organizationId: string): Promise<boolean> {
    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { ipAllowlist: true },
    });

    if (!settings?.ipAllowlist) return true;

    const allowedCidrs: string[] = JSON.parse(settings.ipAllowlist);
    if (allowedCidrs.length === 0) return true;

    const requestIp = await getRequestIp();
    if (!requestIp) return false;

    return allowedCidrs.some((cidr) => isIpInCidr(requestIp, cidr));
  }
}

/**
 * Simple CIDR matching for IPv4.
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  // Handle plain IP (no CIDR notation)
  if (!cidr.includes("/")) return ip === cidr;

  const [network, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr, 10);

  const ipInt = ipToInt(ip);
  const networkInt = ipToInt(network);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

  return (ipInt & mask) === (networkInt & mask);
}

function ipToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// ---------------------------------------------------------------------------
// CSRF Origin Validation
// ---------------------------------------------------------------------------

export class CsrfProtection {
  /**
   * Validate that the request origin matches the allowed origins.
   * Protects against CSRF attacks on state-changing endpoints.
   */
  static async validateOrigin(allowedOrigins?: string[]): Promise<boolean> {
    const requestHeaders = await headers();
    const origin = requestHeaders.get("origin");
    const host = requestHeaders.get("host");

    // Same-origin requests have no origin or origin matches host
    if (!origin) return true;

    if (allowedOrigins && allowedOrigins.length > 0) {
      return allowedOrigins.some((allowed) => origin === allowed);
    }

    // Default: origin must match the host
    const originHost = new URL(origin).host;
    return originHost === host;
  }

  /**
   * Validate that state-changing requests have the correct content type.
   * Prevents form-submission-based CSRF.
   */
  static async validateContentType(): Promise<boolean> {
    const requestHeaders = await headers();
    const contentType = requestHeaders.get("content-type") ?? "";
    const method = requestHeaders.get("x-method-override") ?? requestHeaders.get("x-http-method") ?? "";

    // Only validate for methods that change state
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
      return true;
    }

    // Require JSON content type for API requests
    return contentType.includes("application/json") || contentType.includes("multipart/form-data");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getRequestIp(): Promise<string | null> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() ?? requestHeaders.get("x-real-ip") ?? null;
}
