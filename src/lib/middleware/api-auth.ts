import "server-only";

import { headers } from "next/headers";
import { ApiKeyService } from "../services/api-key.service";
import { RateLimiter, CsrfProtection, IpAllowlist } from "../services/security-hardening.service";
import { getActiveSession } from "../auth";

/**
 * API Authentication Middleware
 *
 * Validates requests to /api/* routes using either:
 * 1. Session cookie (browser requests)
 * 2. Bearer token (API key requests)
 *
 * Also enforces rate limiting and IP allowlisting.
 */

export interface AuthContext {
  organizationId: string;
  userId?: string;
  authMethod: "SESSION" | "API_KEY";
  apiKeyId?: string;
  permissions?: Record<string, unknown>;
}

export interface AuthResult {
  authenticated: boolean;
  context?: AuthContext;
  error?: string;
  statusCode?: number;
}

/**
 * Authenticate an API request.
 * Call this at the top of every API route handler.
 */
export async function authenticateApiRequest(): Promise<AuthResult> {
  const requestHeaders = await headers();
  const authorization = requestHeaders.get("authorization");

  // 1. Try API key authentication
  if (authorization?.startsWith("Bearer drift_")) {
    const token = authorization.replace("Bearer ", "");
    const validation = await ApiKeyService.validate(token);

    if (!validation.valid) {
      return {
        authenticated: false,
        error: validation.error,
        statusCode: 401,
      };
    }

    // Check IP allowlist
    const ipAllowed = await IpAllowlist.isAllowed(validation.organizationId!);
    if (!ipAllowed) {
      return {
        authenticated: false,
        error: "IP address not allowed",
        statusCode: 403,
      };
    }

    return {
      authenticated: true,
      context: {
        organizationId: validation.organizationId!,
        apiKeyId: validation.apiKeyId,
        authMethod: "API_KEY",
        permissions: validation.permissions,
      },
    };
  }

  // 2. Try session authentication
  const session = await getActiveSession();
  if (session) {
    // Rate limit by user
    const rateLimit = RateLimiter.checkByUser(session.user.id);
    if (!rateLimit.allowed) {
      return {
        authenticated: false,
        error: "Rate limit exceeded",
        statusCode: 429,
      };
    }

    return {
      authenticated: true,
      context: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        authMethod: "SESSION",
      },
    };
  }

  return {
    authenticated: false,
    error: "Authentication required",
    statusCode: 401,
  };
}

/**
 * Check if the authenticated context has the required permission.
 */
export function hasPermission(
  context: AuthContext,
  action: "read" | "write",
  resource: string,
): boolean {
  // Session auth has full permissions (gated by role elsewhere)
  if (context.authMethod === "SESSION") return true;

  // API key auth checks the permissions object
  const perms = context.permissions as Record<string, string[]> | undefined;
  if (!perms) return false;

  const allowed = perms[action];
  if (!Array.isArray(allowed)) return false;

  return allowed.includes(resource) || allowed.includes("*");
}
