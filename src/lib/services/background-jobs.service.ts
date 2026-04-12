import "server-only";

import prisma from "@/lib/db";
import { AuditEventService } from "./audit-event.service";
import { SSENotificationService } from "./sse-notification.service";

/**
 * Background Jobs Service
 *
 * Provides a lightweight job queue using the database as the backing store.
 * For production scale, replace with Inngest, BullMQ, or Temporal.
 *
 * Jobs are persisted in the Task model with source="BACKGROUND_JOB"
 * and processed by a polling worker or API route trigger.
 *
 * Job types:
 * - OPPORTUNITY_SCAN: Run opportunity engine across all clients
 * - COMPLIANCE_CHECK: Run global compliance audit
 * - BRIEF_GENERATION: Generate pre-meeting briefs for upcoming meetings
 * - CALENDAR_SYNC: Sync calendar from integration
 * - DATA_SYNC: Sync data from custodian/portfolio integrations
 * - MEMORY_SNAPSHOT: Refresh client memory snapshots
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JobType =
  | "OPPORTUNITY_SCAN"
  | "COMPLIANCE_CHECK"
  | "BRIEF_GENERATION"
  | "CALENDAR_SYNC"
  | "DATA_SYNC"
  | "MEMORY_SNAPSHOT"
  | "OUTBOUND_WEBHOOK";

export interface JobPayload {
  organizationId: string;
  userId?: string;
  jobType: JobType;
  params?: Record<string, unknown>;
  scheduledFor?: Date;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

export interface JobResult {
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Job Queue (Database-backed)
// ---------------------------------------------------------------------------

export class BackgroundJobService {
  /**
   * Enqueue a background job.
   */
  static async enqueue(payload: JobPayload): Promise<string> {
    const task = await prisma.task.create({
      data: {
        userId: payload.userId,
        title: `[BG] ${payload.jobType}`,
        description: JSON.stringify(payload.params ?? {}),
        priority: payload.priority ?? "MEDIUM",
        source: "AI_GENERATED", // Using existing enum value; semantically = BACKGROUND_JOB
        dueDate: payload.scheduledFor ?? new Date(),
      },
    });

    await AuditEventService.appendEvent({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action: "BACKGROUND_JOB_ENQUEUED",
      target: "Task",
      targetId: task.id,
      details: `Background job enqueued: ${payload.jobType}`,
      severity: "INFO",
      metadata: { jobType: payload.jobType, taskId: task.id },
    });

    return task.id;
  }

  /**
   * Process a single job by ID.
   */
  static async processJob(taskId: string): Promise<JobResult> {
    const startMs = Date.now();

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.isCompleted) {
      return { success: false, error: "Job not found or already completed", durationMs: 0 };
    }

    const jobType = task.title.replace("[BG] ", "") as JobType;
    const params = task.description ? JSON.parse(task.description) : {};

    try {
      let result: Record<string, unknown> = {};

      switch (jobType) {
        case "OPPORTUNITY_SCAN": {
          const { OpportunityEngine } = await import("../engines/opportunity.engine");
          const scanResult = await OpportunityEngine.scanAllClients(params.organizationId);
          result = { opportunitiesCreated: scanResult.length };
          break;
        }
        case "COMPLIANCE_CHECK": {
          const { ComplianceService } = await import("./compliance.service");
          const checkResult = await ComplianceService.runGlobalComplianceCheck(params.organizationId);
          result = checkResult;
          break;
        }
        case "BRIEF_GENERATION": {
          const { BriefEngine } = await import("../engines/brief.engine");
          const briefResult = await BriefEngine.generateBrief(params.meetingId as string, params.organizationId);
          result = { briefGenerated: !!briefResult };
          break;
        }
        case "MEMORY_SNAPSHOT": {
          const { ClientMemoryEngine } = await import("../engines/client-memory.engine");
          const snapshotResult = await ClientMemoryEngine.generateSnapshot(params.clientId as string);
          result = { snapshotId: snapshotResult.id };
          break;
        }
        case "CALENDAR_SYNC": {
          const { IntegrationService } = await import("./integration.service");
          const ctx = { userId: task.userId ?? "system", organizationId: params.organizationId };
          const syncResult = await IntegrationService.syncCalendar(ctx as any);
          result = syncResult;
          break;
        }
        case "OUTBOUND_WEBHOOK": {
          const webhookResult = await this.dispatchWebhook(params);
          result = webhookResult;
          break;
        }
        default:
          result = { message: `Unknown job type: ${jobType}` };
      }

      // Mark task as completed
      await prisma.task.update({
        where: { id: taskId },
        data: { isCompleted: true, completedAt: new Date() },
      });

      // Notify the user
      if (task.userId) {
        await SSENotificationService.createAndPush({
          organizationId: params.organizationId,
          userId: task.userId,
          type: "BACKGROUND_JOB",
          title: `Job completed: ${jobType}`,
          body: `Background job ${jobType} completed successfully.`,
          link: "/notifications",
          metadata: { jobType, taskId, result },
        });
      }

      return { success: true, result, durationMs: Date.now() - startMs };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      await AuditEventService.appendEvent({
        organizationId: params.organizationId,
        userId: task.userId ?? undefined,
        action: "BACKGROUND_JOB_FAILED",
        target: "Task",
        targetId: taskId,
        details: `Background job ${jobType} failed: ${errorMessage}`,
        severity: "WARNING",
        metadata: { jobType, error: errorMessage },
      });

      return { success: false, error: errorMessage, durationMs: Date.now() - startMs };
    }
  }

  /**
   * Process all pending jobs for an organization.
   */
  static async processPendingJobs(organizationId: string): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const pendingJobs = await prisma.task.findMany({
      where: {
        isCompleted: false,
        title: { startsWith: "[BG]" },
        dueDate: { lte: new Date() },
        source: "AI_GENERATED",
      },
      take: 20,
      orderBy: { priority: "desc" },
    });

    let succeeded = 0;
    let failed = 0;

    for (const job of pendingJobs) {
      const result = await this.processJob(job.id);
      if (result.success) succeeded++;
      else failed++;
    }

    return { processed: pendingJobs.length, succeeded, failed };
  }

  /**
   * Dispatch an outbound webhook to all configured endpoints for an event.
   */
  private static async dispatchWebhook(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { organizationId, eventType, payload } = params;
    const webhooks = await prisma.outboundWebhook.findMany({
      where: {
        organizationId: organizationId as string,
        isActive: true,
      },
    });

    const results: Array<{ url: string; success: boolean; status?: number }> = [];

    for (const webhook of webhooks) {
      const events = webhook.events as string[];
      if (!events.includes(eventType as string)) continue;

      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Drift-Signature": this.signPayload(JSON.stringify(payload), webhook.secret),
            "X-Drift-Event": eventType as string,
          },
          body: JSON.stringify({
            event: eventType,
            timestamp: new Date().toISOString(),
            data: payload,
          }),
        });

        results.push({ url: webhook.url, success: response.ok, status: response.status });

        await prisma.outboundWebhook.update({
          where: { id: webhook.id },
          data: { lastDeliveryAt: new Date(), failureCount: 0 },
        });
      } catch (err) {
        results.push({ url: webhook.url, success: false });

        await prisma.outboundWebhook.update({
          where: { id: webhook.id },
          data: {
            failureCount: { increment: 1 },
            lastFailure: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }

    return { dispatched: results.length, results };
  }

  /**
   * Sign a webhook payload with HMAC-SHA256.
   */
  private static signPayload(payload: string, secret: string): string {
    const { createHmac } = require("crypto");
    return createHmac("sha256", secret).update(payload).digest("hex");
  }

  // -----------------------------------------------------------------------
  // Scheduled job helpers — enqueue recurring jobs
  // -----------------------------------------------------------------------

  /**
   * Schedule the daily opportunity scan for all organizations.
   * Call this from a cron route or external scheduler.
   */
  static async scheduleDailyOpportunityScan() {
    const orgs = await prisma.organization.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    for (const org of orgs) {
      await this.enqueue({
        organizationId: org.id,
        jobType: "OPPORTUNITY_SCAN",
        priority: "MEDIUM",
        scheduledFor: new Date(),
      });
    }

    return { scheduled: orgs.length };
  }

  /**
   * Schedule the weekly compliance check for all organizations.
   */
  static async scheduleWeeklyComplianceCheck() {
    const orgs = await prisma.organization.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    for (const org of orgs) {
      await this.enqueue({
        organizationId: org.id,
        jobType: "COMPLIANCE_CHECK",
        priority: "HIGH",
        scheduledFor: new Date(),
      });
    }

    return { scheduled: orgs.length };
  }

  /**
   * Schedule brief generation for all upcoming meetings within 24 hours.
   */
  static async scheduleUpcomingBriefs(organizationId: string) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const meetings = await prisma.meeting.findMany({
      where: {
        scheduledAt: { gte: new Date(), lte: tomorrow },
        briefGenerated: false,
        status: "SCHEDULED",
        client: { organizationId, deletedAt: null },
      },
      select: { id: true, clientId: true },
    });

    for (const meeting of meetings) {
      await this.enqueue({
        organizationId,
        jobType: "BRIEF_GENERATION",
        params: { meetingId: meeting.id, clientId: meeting.clientId },
        priority: "HIGH",
      });
    }

    return { scheduled: meetings.length };
  }
}
