import prisma from "@/lib/db";
import { AuditService } from "@/lib/services/audit.service";
import type { SecurityContext } from "@/lib/services/security.service";

type EmailWebhookPayload = {
  communicationId: string;
  to: string;
  subject: string | null;
  body: string | null;
  clientName: string;
  advisorUserId: string;
  organizationId: string;
};

type SystemEmailPayload = {
  to: string;
  subject: string;
  body: string;
  organizationId: string;
};

type CalendarWebhookResponse = {
  meetings?: Array<{
    clientEmail?: string | null;
    clientName?: string | null;
    title: string;
    type?: string | null;
    scheduledAt: string;
    attendees?: string | null;
    notes?: string | null;
    status?: string | null;
  }>;
};

type IntegrationConfig = {
  appBaseUrl: string;
  appBaseUrlSource: "DATABASE" | "ENV" | "DEFAULT";
  emailDeliveryWebhookUrl: string | null;
  emailSource: "DATABASE" | "ENV" | "UNCONFIGURED";
  calendarSyncWebhookUrl: string | null;
  calendarSource: "DATABASE" | "ENV" | "UNCONFIGURED";
};

export class IntegrationService {
  static async getConfig(organizationId?: string): Promise<IntegrationConfig> {
    const settings = organizationId
      ? await prisma.organizationSettings.findUnique({
          where: { organizationId },
          select: {
            appBaseUrl: true,
            emailDeliveryWebhookUrl: true,
            calendarSyncWebhookUrl: true,
          },
        })
      : null;

    const appBaseUrl = settings?.appBaseUrl?.trim() || process.env.APP_BASE_URL || "http://127.0.0.1:3000";
    const emailDeliveryWebhookUrl = settings?.emailDeliveryWebhookUrl?.trim() || process.env.EMAIL_DELIVERY_WEBHOOK_URL || null;
    const calendarSyncWebhookUrl = settings?.calendarSyncWebhookUrl?.trim() || process.env.CALENDAR_SYNC_WEBHOOK_URL || null;

    return {
      appBaseUrl,
      appBaseUrlSource: settings?.appBaseUrl?.trim() ? "DATABASE" : process.env.APP_BASE_URL ? "ENV" : "DEFAULT",
      emailDeliveryWebhookUrl,
      emailSource: settings?.emailDeliveryWebhookUrl?.trim() ? "DATABASE" : process.env.EMAIL_DELIVERY_WEBHOOK_URL ? "ENV" : "UNCONFIGURED",
      calendarSyncWebhookUrl,
      calendarSource: settings?.calendarSyncWebhookUrl?.trim() ? "DATABASE" : process.env.CALENDAR_SYNC_WEBHOOK_URL ? "ENV" : "UNCONFIGURED",
    };
  }

  static async getStatus(organizationId?: string) {
    const config = await this.getConfig(organizationId);

    return {
      appBaseUrl: config.appBaseUrl,
      appBaseUrlSource: config.appBaseUrlSource,
      emailConfigured: Boolean(config.emailDeliveryWebhookUrl),
      emailSource: config.emailSource,
      calendarConfigured: Boolean(config.calendarSyncWebhookUrl),
      calendarSource: config.calendarSource,
    };
  }

  static async deliverEmail(payload: EmailWebhookPayload, ctx: SecurityContext) {
    const config = await this.getConfig(ctx.organizationId);
    const url = config.emailDeliveryWebhookUrl;
    if (!url) {
      await AuditService.logAction({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "EMAIL_DELIVERY_UNAVAILABLE",
        target: `Communication:${payload.communicationId}`,
        details: "Email delivery integration is not configured.",
        severity: "WARNING",
      });
      throw new Error("Email delivery integration is not configured.");
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      await AuditService.logAction({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "EMAIL_DELIVERY_FAILED",
        target: `Communication:${payload.communicationId}`,
        details: `Email delivery webhook failed with status ${response.status}. ${body}`.trim(),
        severity: "WARNING",
      });
      throw new Error(`Email delivery failed with status ${response.status}.`);
    }
  }

  static async deliverSystemEmail(payload: SystemEmailPayload, ctx: SecurityContext, target: string) {
    const config = await this.getConfig(ctx.organizationId);
    const url = config.emailDeliveryWebhookUrl;
    if (!url) {
      await AuditService.logAction({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "EMAIL_DELIVERY_UNAVAILABLE",
        target,
        details: "System email delivery integration is not configured.",
        severity: "WARNING",
      });
      throw new Error("Email delivery integration is not configured.");
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        communicationId: target,
        to: payload.to,
        subject: payload.subject,
        body: payload.body,
        clientName: "System Recipient",
        advisorUserId: ctx.userId,
        organizationId: payload.organizationId,
      } satisfies EmailWebhookPayload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      await AuditService.logAction({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "EMAIL_DELIVERY_FAILED",
        target,
        details: `System email webhook failed with status ${response.status}. ${body}`.trim(),
        severity: "WARNING",
      });
      throw new Error(`Email delivery failed with status ${response.status}.`);
    }
  }

  static async syncCalendar(ctx: SecurityContext) {
    const config = await this.getConfig(ctx.organizationId);
    const url = config.calendarSyncWebhookUrl;
    if (!url) {
      await AuditService.logAction({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "CALENDAR_SYNC_UNAVAILABLE",
        target: "System:Calendar",
        details: "Calendar sync integration is not configured.",
        severity: "WARNING",
      });
      throw new Error("Calendar sync integration is not configured.");
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      await AuditService.logAction({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "CALENDAR_SYNC_FAILED",
        target: "System:Calendar",
        details: `Calendar sync webhook failed with status ${response.status}. ${body}`.trim(),
        severity: "WARNING",
      });
      throw new Error(`Calendar sync failed with status ${response.status}.`);
    }

    const data = (await response.json()) as CalendarWebhookResponse;
    const meetings = data.meetings ?? [];
    let upserted = 0;

    for (const externalMeeting of meetings) {
      let client = null;

      if (externalMeeting.clientEmail) {
        client = await prisma.client.findFirst({
          where: {
            organizationId: ctx.organizationId,
            email: externalMeeting.clientEmail,
          },
          select: { id: true },
        });
      }

      if (!client && externalMeeting.clientName) {
        client = await prisma.client.findFirst({
          where: {
            organizationId: ctx.organizationId,
            name: externalMeeting.clientName,
          },
          select: { id: true },
        });
      }

      if (!client) {
        continue;
      }

      const scheduledAt = new Date(externalMeeting.scheduledAt);
      const existing = await prisma.meeting.findFirst({
        where: {
          clientId: client.id,
          title: externalMeeting.title,
          scheduledAt,
        },
        select: { id: true },
      });

      if (existing) {
        continue;
      }

      await prisma.meeting.create({
        data: {
          clientId: client.id,
          title: externalMeeting.title,
          type: externalMeeting.type ?? "REVIEW",
          scheduledAt,
          attendees: externalMeeting.attendees ?? null,
          notes: externalMeeting.notes ?? null,
          status: externalMeeting.status ?? "SCHEDULED",
        },
      });
      upserted += 1;
    }

    await AuditService.logAction({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "CALENDAR_SYNC_COMPLETED",
      target: "System:Calendar",
      details: `Calendar sync completed. Imported ${upserted} meetings from webhook payload.`,
      severity: "INFO",
    });

    await prisma.notification.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        type: "CALENDAR",
        title: "Calendar sync completed",
        body: upserted > 0
          ? `Imported ${upserted} meetings from the configured calendar integration.`
          : "Calendar sync completed but no meetings matched stored clients.",
        link: "/meetings",
      },
    });

    return { imported: upserted };
  }
}
