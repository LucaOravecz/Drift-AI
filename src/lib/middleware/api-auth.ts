import "server-only";

import { headers } from "next/headers";
import { ApiKeyService } from "../services/api-key.service";
import { IpAllowlist } from "../services/security-hardening.service";
import { getActiveSession } from "../auth";
import { roleHasAllCapabilities } from "../services/security.service";
import { requiredCapabilitiesForApiResource } from "./api-resource-permissions";
import { limitByUser } from "../services/distributed-rate-limiter";

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
  /** Present for session auth — used for fine-grained API RBAC */
  role?: string;
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
    const rateLimit = await limitByUser(session.user.id);
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
        role: session.user.role,
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
 * Session users are gated by institutional role; API keys use scoped permissions JSON.
 */
export function hasPermission(
  context: AuthContext,
  action: "read" | "write",
  resource: string,
): boolean {
  if (context.authMethod === "API_KEY") {
    const perms = context.permissions as Record<string, string[]> | undefined;
    if (!perms) return false;

    const allowed = perms[action];
    if (!Array.isArray(allowed)) return false;

    const resourceAliases =
      resource === "custodian_integrations" ? [resource, "integrations"] : [resource];
    return (
      allowed.includes("*") ||
      resourceAliases.some((r) => allowed.includes(r))
    );
  }

  if (context.authMethod === "SESSION") {
    if (!context.role) return false;
    const required = requiredCapabilitiesForApiResource(action, resource);
    if (!required) return false;
    return roleHasAllCapabilities(context.role, required);
  }

  return false;
}
