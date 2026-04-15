import "server-only";

import prisma from "@/lib/db";
import { AuditEventService } from "./audit-event.service";

/**
 * Billing & Subscription Service
 *
 * Manages Stripe-backed subscriptions, seat counting, and feature gating.
 * Webhook handlers in `/api/stripe/webhook` sync subscription state when Stripe keys are configured.
 */

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

export type PlanTier = "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
export type LaunchFeature =
  | "POST_MEETING_WORKFLOW"
  | "CUSTODIAN_SYNC"
  | "CLIENT_PORTAL"
  | "MARKET_DATA";

export interface PlanLimits {
  maxSeats: number;
  maxClients: number;
  aiBudgetMonthly: number; // USD
  complianceScansMonthly: number;
  apiAccess: boolean;
  customComplianceRules: boolean;
  whiteLabeling: boolean;
  ssoEnabled: boolean;
  marketDataFeeds: boolean;
  auditRetentionDays: number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  STARTER: {
    maxSeats: 3,
    maxClients: 100,
    aiBudgetMonthly: 50,
    complianceScansMonthly: 200,
    apiAccess: false,
    customComplianceRules: false,
    whiteLabeling: false,
    ssoEnabled: false,
    marketDataFeeds: false,
    auditRetentionDays: 2555, // 7 years
  },
  PROFESSIONAL: {
    maxSeats: 15,
    maxClients: 1000,
    aiBudgetMonthly: 250,
    complianceScansMonthly: 2000,
    apiAccess: true,
    customComplianceRules: true,
    whiteLabeling: true,
    ssoEnabled: false,
    marketDataFeeds: false,
    auditRetentionDays: 2555,
  },
  ENTERPRISE: {
    maxSeats: -1, // unlimited
    maxClients: -1,
    aiBudgetMonthly: -1,
    complianceScansMonthly: -1,
    apiAccess: true,
    customComplianceRules: true,
    whiteLabeling: true,
    ssoEnabled: true,
    marketDataFeeds: true,
    auditRetentionDays: 2555,
  },
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class BillingService {
  static async checkFeatureAccess(
    organizationId: string,
    feature: LaunchFeature,
  ): Promise<{ allowed: boolean; reason?: string; plan: PlanTier }> {
    const subscription = await this.getSubscription(organizationId);
    const plan = (subscription.plan as PlanTier) ?? "STARTER";

    const allowed = (() => {
      switch (feature) {
        case "POST_MEETING_WORKFLOW":
          return plan === "PROFESSIONAL" || plan === "ENTERPRISE";
        case "CUSTODIAN_SYNC":
          return plan === "PROFESSIONAL" || plan === "ENTERPRISE";
        case "CLIENT_PORTAL":
          return plan === "ENTERPRISE";
        case "MARKET_DATA":
          return plan === "ENTERPRISE";
        default:
          return false;
      }
    })();

    if (allowed) {
      return { allowed: true, plan };
    }

    const reasonMap: Record<LaunchFeature, string> = {
      POST_MEETING_WORKFLOW: "Post-meeting workflow requires the Professional plan or above.",
      CUSTODIAN_SYNC: "Custodian sync requires the Professional plan or above.",
      CLIENT_PORTAL: "Client portal requires the Enterprise plan.",
      MARKET_DATA: "Market data feeds require the Enterprise plan.",
    };

    return {
      allowed: false,
      reason: reasonMap[feature],
      plan,
    };
  }

  /**
   * Get the subscription for an organization, creating a trial if none exists.
   */
  static async getSubscription(organizationId: string) {
    let subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          organizationId,
          plan: "STARTER",
          status: "TRIAL",
          seatCount: 1,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
        },
      });
    }

    return subscription;
  }

  /**
   * Get the effective plan limits for an organization.
   */
  static async getPlanLimits(organizationId: string): Promise<PlanLimits> {
    const subscription = await this.getSubscription(organizationId);
    return PLAN_LIMITS[subscription.plan as PlanTier] ?? PLAN_LIMITS.STARTER;
  }

  /**
   * Check if a specific feature is available for the organization's plan.
   */
  static async hasFeature(
    organizationId: string,
    feature: keyof PlanLimits,
  ): Promise<boolean> {
    const limits = await this.getPlanLimits(organizationId);
    return Boolean(limits[feature]);
  }

  /**
   * Check if the organization can add another seat.
   */
  static async canAddSeat(organizationId: string): Promise<boolean> {
    const [subscription, limits, activeUsers] = await Promise.all([
      this.getSubscription(organizationId),
      this.getPlanLimits(organizationId),
      prisma.user.count({
        where: { organizationId, isActive: true, deletedAt: null },
      }),
    ]);

    if (limits.maxSeats === -1) return true; // unlimited
    return activeUsers < limits.maxSeats;
  }

  /**
   * Check if the organization is within its AI budget.
   */
  static async canUseAi(organizationId: string): Promise<boolean> {
    const limits = await this.getPlanLimits(organizationId);
    if (limits.aiBudgetMonthly === -1) return true; // unlimited

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await prisma.aiUsageRecord.aggregate({
      where: { organizationId, createdAt: { gte: startOfMonth } },
      _sum: { costUsd: true },
    });

    const spent = result._sum.costUsd ?? 0;
    return spent < limits.aiBudgetMonthly;
  }

  /**
   * Update subscription plan (called after Stripe webhook confirmation).
   */
  static async updatePlan(
    organizationId: string,
    plan: PlanTier,
    stripeData?: {
      stripeCustomerId?: string;
      stripePriceId?: string;
      stripeSubscriptionId?: string;
    },
  ) {
    const subscription = await prisma.subscription.upsert({
      where: { organizationId },
      update: {
        plan,
        status: "ACTIVE",
        ...(stripeData?.stripeCustomerId ? { stripeCustomerId: stripeData.stripeCustomerId } : {}),
        ...(stripeData?.stripePriceId ? { stripePriceId: stripeData.stripePriceId } : {}),
        ...(stripeData?.stripeSubscriptionId ? { stripeSubscriptionId: stripeData.stripeSubscriptionId } : {}),
      },
      create: {
        organizationId,
        plan,
        status: "ACTIVE",
        seatCount: 1,
        ...stripeData,
      },
    });

    await AuditEventService.appendEvent({
      organizationId,
      action: "SUBSCRIPTION_UPDATED",
      target: "Subscription",
      targetId: subscription.id,
      details: `Plan updated to ${plan}`,
      severity: "INFO",
      metadata: { plan, stripeData },
    });

    return subscription;
  }

  /**
   * Get billing summary for the current period.
   */
  static async getBillingSummary(organizationId: string) {
    const [subscription, limits] = await Promise.all([
      this.getSubscription(organizationId),
      this.getPlanLimits(organizationId),
    ]);

    const [aiUsage, activeUsers, clientCount] = await Promise.all([
      (async () => {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const result = await prisma.aiUsageRecord.aggregate({
          where: { organizationId, createdAt: { gte: startOfMonth } },
          _sum: { costUsd: true, inputTokens: true, outputTokens: true },
          _count: true,
        });
        return {
          totalCost: result._sum.costUsd ?? 0,
          totalCalls: result._count,
          inputTokens: result._sum.inputTokens ?? 0,
          outputTokens: result._sum.outputTokens ?? 0,
          budgetRemaining: limits.aiBudgetMonthly === -1
            ? Infinity
            : Math.max(0, limits.aiBudgetMonthly - (result._sum.costUsd ?? 0)),
        };
      })(),
      prisma.user.count({ where: { organizationId, isActive: true, deletedAt: null } }),
      prisma.client.count({ where: { organizationId, deletedAt: null } }),
    ]);

    return {
      plan: subscription.plan,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      seats: { used: activeUsers, limit: limits.maxSeats },
      clients: { used: clientCount, limit: limits.maxClients },
      ai: aiUsage,
      periodEnd: subscription.currentPeriodEnd,
    };
  }

  // -----------------------------------------------------------------------
  // Stripe webhook handlers (stub — activate with Stripe API key)
  // -----------------------------------------------------------------------

  /**
   * Handle checkout.session.completed — upgrade subscription.
   */
  static async handleCheckoutComplete(session: {
    customer: string;
    subscription: string;
    client_reference_id?: string;
    metadata?: Record<string, string>;
  }) {
    const organizationId = session.metadata?.organizationId;
    if (!organizationId) return;

    await this.updatePlan(organizationId, (session.metadata?.plan as PlanTier) ?? "PROFESSIONAL", {
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
    });
  }

  /**
   * Handle customer.subscription.deleted — downgrade to starter.
   */
  static async handleSubscriptionDeleted(stripeSubscriptionId: string) {
    const subscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId },
    });
    if (!subscription) return;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { plan: "STARTER", status: "CANCELED", canceledAt: new Date() },
    });

    await AuditEventService.appendEvent({
      organizationId: subscription.organizationId,
      action: "SUBSCRIPTION_CANCELED",
      target: "Subscription",
      targetId: subscription.id,
      details: "Subscription canceled via Stripe webhook",
      severity: "WARNING",
    });
  }
}
