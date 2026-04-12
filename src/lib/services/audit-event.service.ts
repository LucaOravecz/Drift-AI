import "server-only";

import prisma from "@/lib/db";
import { createHash } from "crypto";

/**
 * Immutable Audit Event Service
 *
 * Append-only, tamper-evident audit ledger for SEC books-and-records compliance.
 * Uses a hash chain (similar to blockchain) to detect any tampering with historical records.
 *
 * Regulatory basis:
 * - SEC Rule 17a-4: Books and records must be preserved for 6 years
 * - FINRA Rule 4511: Electronic record retention requirements
 * - SEC Advertising Rule 206(4)-1: Compliance documentation
 */

export type AuditEventSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface CreateAuditEventParams {
  organizationId: string;
  userId?: string;
  action: string;
  target: string;
  targetId?: string;
  details: string;
  aiInvolved?: boolean;
  severity?: AuditEventSeverity;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  metadata?: {
    ip?: string;
    userAgent?: string;
    reasoningTrace?: string;
    model?: string;
    tokens?: number;
    [key: string]: unknown;
  };
}

/**
 * Compute a SHA-256 hash of the event payload for tamper detection.
 * Includes the previous event's hash to create a chain.
 */
function computeEventHash(
  data: Omit<CreateAuditEventParams, "metadata"> & {
    metadata?: Record<string, unknown>;
    previousHash: string | null;
    timestamp: Date;
  }
): string {
  const payload = JSON.stringify({
    organizationId: data.organizationId,
    userId: data.userId,
    action: data.action,
    target: data.target,
    targetId: data.targetId,
    details: data.details,
    aiInvolved: data.aiInvolved,
    severity: data.severity,
    beforeState: data.beforeState,
    afterState: data.afterState,
    metadata: data.metadata,
    previousHash: data.previousHash,
    timestamp: data.timestamp.toISOString(),
  });
  return createHash("sha256").update(payload).digest("hex");
}

export class AuditEventService {
  /**
   * Append an immutable audit event to the ledger.
   * This operation is irreversible — events can never be modified or deleted.
   */
  static async appendEvent(params: CreateAuditEventParams): Promise<{
    id: string;
    eventHash: string;
  }> {
    const timestamp = new Date();

    // Get the previous event's hash for the chain
    const lastEvent = await prisma.auditEvent.findFirst({
      where: { organizationId: params.organizationId },
      orderBy: { timestamp: "desc" },
      select: { eventHash: true },
    });

    const previousHash = lastEvent?.eventHash ?? null;

    const eventHash = computeEventHash({
      ...params,
      metadata: params.metadata as Record<string, unknown> | undefined,
      previousHash,
      timestamp,
    });

    const event = await prisma.auditEvent.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        action: params.action,
        target: params.target,
        targetId: params.targetId,
        details: params.details,
        aiInvolved: params.aiInvolved ?? false,
        severity: params.severity ?? "INFO",
        beforeState: params.beforeState ?? undefined,
        afterState: params.afterState ?? undefined,
        metadata: params.metadata ?? undefined,
        eventHash,
        previousHash,
        timestamp,
      },
      select: { id: true, eventHash: true },
    });

    return { id: event.id, eventHash: event.eventHash };
  }

  /**
   * Verify the integrity of the audit event chain for an organization.
   * Returns any breaks in the hash chain that would indicate tampering.
   */
  static async verifyChain(organizationId: string): Promise<{
    isValid: boolean;
    totalEvents: number;
    breaks: Array<{ eventId: string; expectedHash: string; actualHash: string }>;
  }> {
    const events = await prisma.auditEvent.findMany({
      where: { organizationId },
      orderBy: { timestamp: "asc" },
      select: {
        id: true,
        eventHash: true,
        previousHash: true,
        organizationId: true,
        userId: true,
        action: true,
        target: true,
        targetId: true,
        details: true,
        aiInvolved: true,
        severity: true,
        beforeState: true,
        afterState: true,
        metadata: true,
        timestamp: true,
      },
    });

    const breaks: Array<{ eventId: string; expectedHash: string; actualHash: string }> = [];
    let expectedPreviousHash: string | null = null;

    for (const event of events) {
      // Check that previousHash matches the chain
      if (event.previousHash !== expectedPreviousHash) {
        breaks.push({
          eventId: event.id,
          expectedHash: expectedPreviousHash ?? "null",
          actualHash: event.previousHash ?? "null",
        });
      }

      // Verify the event's own hash
      const computedHash = computeEventHash({
        organizationId: event.organizationId,
        userId: event.userId,
        action: event.action,
        target: event.target,
        targetId: event.targetId,
        details: event.details,
        aiInvolved: event.aiInvolved,
        severity: event.severity as AuditEventSeverity,
        beforeState: event.beforeState as Record<string, unknown> | undefined,
        afterState: event.afterState as Record<string, unknown> | undefined,
        metadata: event.metadata as Record<string, unknown> | undefined,
        previousHash: event.previousHash,
        timestamp: event.timestamp,
      });

      if (computedHash !== event.eventHash) {
        breaks.push({
          eventId: event.id,
          expectedHash: computedHash,
          actualHash: event.eventHash,
        });
      }

      expectedPreviousHash = event.eventHash;
    }

    return {
      isValid: breaks.length === 0,
      totalEvents: events.length,
      breaks,
    };
  }

  /**
   * Query audit events for e-discovery and regulatory examination.
   */
  static async queryEvents(params: {
    organizationId: string;
    action?: string;
    userId?: string;
    target?: string;
    targetId?: string;
    aiInvolved?: boolean;
    severity?: AuditEventSeverity;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    cursor?: string;
  }) {
    const where: Record<string, unknown> = {
      organizationId: params.organizationId,
    };

    if (params.action) where.action = params.action;
    if (params.userId) where.userId = params.userId;
    if (params.target) where.target = params.target;
    if (params.targetId) where.targetId = params.targetId;
    if (params.aiInvolved !== undefined) where.aiInvolved = params.aiInvolved;
    if (params.severity) where.severity = params.severity;
    if (params.startDate || params.endDate) {
      where.timestamp = {
        ...(params.startDate ? { gte: params.startDate } : {}),
        ...(params.endDate ? { lte: params.endDate } : {}),
      };
    }
    if (params.cursor) {
      where.id = { gt: params.cursor };
    }

    return prisma.auditEvent.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: params.limit ?? 100,
    });
  }
}
