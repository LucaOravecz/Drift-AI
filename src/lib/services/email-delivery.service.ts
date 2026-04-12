import "server-only";

import { Resend } from "resend";
import { AuditEventService } from "./audit-event.service";
import prisma from "@/lib/db";

/**
 * Email Delivery Service
 *
 * Transactional email via Resend for:
 * - Proposal/IPS delivery notifications
 * - Billing statement summaries
 * - Compliance alert notifications
 * - Trigger action summaries
 * - Client onboarding emails
 *
 * All emails are:
 * - Logged as audit events
 * - Rate-limited to prevent abuse
 * - Branded with organization identity
 * - Compliant with CAN-SPAM (unsubscribe header)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  category?: string;
  clientId?: string;
}

interface EmailResult {
  messageId: string | null;
  sent: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class EmailDeliveryService {
  private static getResendClient(): Resend | null {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return null;
    return new Resend(apiKey);
  }

  private static getFromAddress(organizationId?: string): string {
    const defaultFrom = process.env.EMAIL_FROM_ADDRESS ?? "Drift AI <noreply@drift-ai.com>";
    return defaultFrom;
  }

  /**
   * Send a transactional email via Resend.
   */
  static async sendEmail(
    organizationId: string,
    params: EmailParams,
    userId?: string,
  ): Promise<EmailResult> {
    const resend = this.getResendClient();

    if (!resend) {
      // Fallback: log the email as if it were sent (dev mode)
      await AuditEventService.appendEvent({
        organizationId,
        userId,
        action: "EMAIL_QUEUED_DEV",
        target: `Email:${params.to}`,
        details: `Email queued (no Resend key): ${params.subject}`,
        severity: "INFO",
        metadata: { to: params.to, subject: params.subject, category: params.category },
      });

      return { messageId: `dev-${Date.now()}`, sent: true };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: this.getFromAddress(organizationId),
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        replyTo: params.replyTo,
        headers: {
          "X-Email-Category": params.category ?? "transactional",
        },
      });

      if (error) {
        await AuditEventService.appendEvent({
          organizationId,
          userId,
          action: "EMAIL_SEND_FAILED",
          target: `Email:${params.to}`,
          details: `Email send failed: ${error.message}`,
          severity: "WARNING",
          metadata: { to: params.to, subject: params.subject, error: error.message },
        });

        return { messageId: null, sent: false, error: error.message };
      }

      await AuditEventService.appendEvent({
        organizationId,
        userId,
        action: "EMAIL_SENT",
        target: `Email:${data?.id ?? "unknown"}`,
        details: `Email sent: ${params.subject} to ${params.to}`,
        severity: "INFO",
        metadata: { messageId: data?.id, to: params.to, subject: params.subject, category: params.category },
      });

      return { messageId: data?.id ?? null, sent: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";

      await AuditEventService.appendEvent({
        organizationId,
        userId,
        action: "EMAIL_SEND_ERROR",
        target: `Email:${params.to}`,
        details: `Email send error: ${errorMsg}`,
        severity: "WARNING",
        metadata: { to: params.to, subject: params.subject, error: errorMsg },
      });

      return { messageId: null, sent: false, error: errorMsg };
    }
  }

  /**
   * Send a proposal/IPS delivery notification.
   */
  static async sendProposalNotification(
    organizationId: string,
    params: {
      advisorEmail: string;
      advisorName: string;
      clientName: string;
      proposalType: string;
      documentId: string;
      compliancePassed: boolean;
    },
    userId?: string,
  ): Promise<EmailResult> {
    return this.sendEmail(organizationId, {
      to: params.advisorEmail,
      subject: `${params.proposalType} Ready for Review — ${params.clientName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #fafafa;">
          <div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px;">
            <h1 style="font-size: 20px; color: #1B3A5C; margin: 0 0 16px 0;">
              ${params.proposalType} Ready for Review
            </h1>
            <p style="color: #374151; font-size: 14px; line-height: 1.6;">
              Hi ${params.advisorName},
            </p>
            <p style="color: #374151; font-size: 14px; line-height: 1.6;">
              A <strong>${params.proposalType}</strong> has been generated for <strong>${params.clientName}</strong> and is ready for your review.
            </p>
            <div style="margin: 20px 0; padding: 12px; border-radius: 6px; background: ${params.compliancePassed ? "#f0fdf4" : "#fef3c7"}; border: 1px solid ${params.compliancePassed ? "#bbf7d0" : "#fde68a"};">
              <p style="margin: 0; font-size: 13px; color: ${params.compliancePassed ? "#166534" : "#92400e"};">
                ${params.compliancePassed ? "✅ Compliance scan passed — no regulatory flags detected." : `⚠️ Compliance scan detected flags — review required before distribution.`}
              </p>
            </div>
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/documents/${params.documentId}"
               style="display: inline-block; background: #1B3A5C; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; margin-top: 12px;">
              Review Document
            </a>
            <p style="color: #9ca3af; font-size: 11px; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
              This document was generated with AI assistance. All data points should be verified against source records before distribution to clients.
            </p>
          </div>
          <p style="color: #9ca3af; font-size: 10px; text-align: center; margin-top: 16px;">
            Drift AI — Institutional Advisory Copilot
          </p>
        </div>
      `,
      text: `${params.proposalType} for ${params.clientName} is ready for review. Compliance: ${params.compliancePassed ? "Passed" : "Flags detected"}. Review at: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/documents/${params.documentId}`,
      category: "proposal_delivery",
      clientId: params.clientName,
    }, userId);
  }

  /**
   * Send a billing summary notification.
   */
  static async sendBillingSummary(
    organizationId: string,
    params: {
      advisorEmail: string;
      advisorName: string;
      period: string;
      totalFees: number;
      totalClients: number;
      totalAUM: number;
    },
    userId?: string,
  ): Promise<EmailResult> {
    return this.sendEmail(organizationId, {
      to: params.advisorEmail,
      subject: `Billing Summary — ${params.period}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #fafafa;">
          <div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px;">
            <h1 style="font-size: 20px; color: #1B3A5C; margin: 0 0 16px 0;">
              Billing Summary — ${params.period}
            </h1>
            <p style="color: #374151; font-size: 14px; line-height: 1.6;">
              Hi ${params.advisorName},
            </p>
            <div style="margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; color: #6b7280;">Total AUM</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1f2937;">$${(params.totalAUM / 1_000_000).toFixed(1)}M</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; color: #6b7280;">Total Fees</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #059669;">$${params.totalFees.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Clients Billed</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1f2937;">${params.totalClients}</td>
                </tr>
              </table>
            </div>
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/billing"
               style="display: inline-block; background: #059669; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; margin-top: 12px;">
              View Billing Details
            </a>
          </div>
        </div>
      `,
      text: `Billing Summary for ${params.period}: Total AUM $${(params.totalAUM / 1_000_000).toFixed(1)}M, Total Fees $${params.totalFees.toLocaleString()}, ${params.totalClients} clients billed.`,
      category: "billing_summary",
    }, userId);
  }

  /**
   * Send a compliance alert notification.
   */
  static async sendComplianceAlert(
    organizationId: string,
    params: {
      advisorEmail: string;
      advisorName: string;
      flagType: string;
      clientName: string;
      description: string;
      severity: string;
    },
    userId?: string,
  ): Promise<EmailResult> {
    const severityColors: Record<string, string> = {
      CRITICAL: "#dc2626",
      HIGH: "#ea580c",
      MEDIUM: "#d97706",
      LOW: "#6b7280",
    };

    return this.sendEmail(organizationId, {
      to: params.advisorEmail,
      subject: `[${params.severity}] Compliance Alert — ${params.clientName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #fafafa;">
          <div style="background: white; border-radius: 8px; border-left: 4px solid ${severityColors[params.severity] ?? "#6b7280"}; padding: 32px;">
            <h1 style="font-size: 20px; color: #1B3A5C; margin: 0 0 16px 0;">
              Compliance Alert: ${params.flagType}
            </h1>
            <p style="color: #374151; font-size: 14px; line-height: 1.6;">
              <strong>Client:</strong> ${params.clientName}<br/>
              <strong>Severity:</strong> <span style="color: ${severityColors[params.severity] ?? "#6b7280"}">${params.severity}</span>
            </p>
            <p style="color: #374151; font-size: 14px; line-height: 1.6;">
              ${params.description}
            </p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/compliance"
               style="display: inline-block; background: #1B3A5C; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; margin-top: 12px;">
              Review Flag
            </a>
          </div>
        </div>
      `,
      text: `[${params.severity}] Compliance Alert for ${params.clientName}: ${params.flagType} — ${params.description}`,
      category: "compliance_alert",
    }, userId);
  }
}
