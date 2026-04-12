import "server-only";

import prisma from "@/lib/db";
import { createHash, randomBytes } from "crypto";
import { AuditEventService } from "./audit-event.service";
import { RateLimiter } from "./security-hardening.service";

/**
 * API Key Service
 *
 * Manages API keys for the developer platform.
 * Keys are stored as SHA-256 hashes — the plaintext key is only shown once at creation.
 */

const KEY_PREFIX = "drift_";

export interface ApiKeyCreateResult {
  id: string;
  name: string;
  key: string; // Only shown once — the full plaintext key
  keyPrefix: string;
  permissions: Record<string, unknown>;
  rateLimit: number;
  expiresAt: Date | null;
}

export interface ApiKeyValidation {
  valid: boolean;
  apiKeyId?: string;
  organizationId?: string;
  permissions?: Record<string, unknown>;
  error?: string;
}

export class ApiKeyService {
  /**
   * Create a new API key for an organization.
   * The plaintext key is returned ONLY at creation time.
   */
  static async create(params: {
    organizationId: string;
    name: string;
    permissions?: Record<string, unknown>;
    rateLimit?: number;
    expiresAt?: Date;
    createdBy?: string;
  }): Promise<ApiKeyCreateResult> {
    // Generate a random key
    const rawKey = randomBytes(32).toString("hex");
    const fullKey = `${KEY_PREFIX}${rawKey}`;

    // Store hash only
    const keyHash = createHash("sha256").update(fullKey).digest("hex");
    const keyPrefix = fullKey.substring(0, 8);

    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId: params.organizationId,
        name: params.name,
        keyHash,
        keyPrefix,
        permissions: params.permissions ?? { read: ["clients", "opportunities", "tax_insights"] },
        rateLimit: params.rateLimit ?? 100,
        expiresAt: params.expiresAt,
        createdBy: params.createdBy,
      },
    });

    await AuditEventService.appendEvent({
      organizationId: params.organizationId,
      userId: params.createdBy,
      action: "API_KEY_CREATED",
      target: "ApiKey",
      targetId: apiKey.id,
      details: `API key created: ${params.name}`,
      severity: "INFO",
      metadata: { keyPrefix, rateLimit: params.rateLimit },
    });

    return {
      id: apiKey.id,
      name: params.name,
      key: fullKey, // Only time the full key is available
      keyPrefix,
      permissions: apiKey.permissions as Record<string, unknown>,
      rateLimit: apiKey.rateLimit,
      expiresAt: apiKey.expiresAt,
    };
  }

  /**
   * Validate an API key from a request header.
   * Returns the key details if valid, or an error if invalid.
   */
  static async validate(bearerToken: string): Promise<ApiKeyValidation> {
    if (!bearerToken.startsWith(KEY_PREFIX)) {
      return { valid: false, error: "Invalid key format" };
    }

    const keyHash = createHash("sha256").update(bearerToken).digest("hex");

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      select: {
        id: true,
        organizationId: true,
        permissions: true,
        rateLimit: true,
        isActive: true,
        expiresAt: true,
      },
    });

    if (!apiKey) {
      return { valid: false, error: "Key not found" };
    }

    if (!apiKey.isActive) {
      return { valid: false, error: "Key has been revoked" };
    }

    if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) {
      return { valid: false, error: "Key has expired" };
    }

    // Rate limit check
    const keyPrefix = bearerToken.substring(0, 8);
    const rateLimitResult = RateLimiter.checkByApiKey(keyPrefix, apiKey.rateLimit);
    if (!rateLimitResult.allowed) {
      return { valid: false, error: "Rate limit exceeded" };
    }

    // Update last used timestamp (non-blocking)
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return {
      valid: true,
      apiKeyId: apiKey.id,
      organizationId: apiKey.organizationId,
      permissions: apiKey.permissions as Record<string, unknown>,
    };
  }

  /**
   * Revoke an API key.
   */
  static async revoke(keyId: string, userId: string, organizationId: string) {
    const apiKey = await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false, revokedAt: new Date() },
    });

    await AuditEventService.appendEvent({
      organizationId,
      userId,
      action: "API_KEY_REVOKED",
      target: "ApiKey",
      targetId: keyId,
      details: `API key revoked: ${apiKey.name}`,
      severity: "WARNING",
    });

    return apiKey;
  }

  /**
   * List all API keys for an organization (without revealing hashes).
   */
  static async list(organizationId: string) {
    return prisma.apiKey.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        rateLimit: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
