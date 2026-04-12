import "server-only";

import prisma from "@/lib/db";
import { AuditEventService } from "./audit-event.service";
import { SSENotificationService } from "./sse-notification.service";

/**
 * Proactive Workflow Triggers Engine
 *
 * Transforms Drift AI from a reactive chatbot into a proactive operating system.
 * Runs on a schedule (cron) and evaluates rule-based triggers across all clients:
 *
 * Trigger categories:
 * - AGE_MILESTONE: Client turning 59½, 70½, 73 → RMD planning, 72(t) options
 * - PORTFOLIO_DRIFT: Asset allocation drifts beyond tolerance → rebalance
 * - ENGAGEMENT_GAP: No contact in X days → outreach task
 * - DOCUMENT_STALE: Estate plan / trust >5 years old → review flag
 * - LIFE_EVENT_FOLLOWUP: Detected life event without follow-up → task
 * - TAX_DEADLINE: Approaching estimated payment dates, year-end harvesting
 * - FEE_SCHEDULE_CHANGE: Client AUM crossed tier boundary → fee recalc
 * - ONBOARDING_STALLED: Onboarding stuck at a step >N days → escalation
 * - CHURN_RISK: Churn score exceeded threshold → retention task
 * - CASH_DRIFT: Cash allocation exceeds target → investment opportunity
 * - SECURITY_MATURE: Bonds/CDs maturing → reinvestment planning
 *
 * Each trigger:
 * 1. Checks deterministic conditions against stored data
 * 2. Creates a Task, Opportunity, or ComplianceFlag as appropriate
 * 3. Notifies the assigned advisor via SSE
 * 4. Logs an immutable audit event
 * 5. Deduplicates against existing active triggers
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TriggerCategory =
  | "AGE_MILESTONE"
  | "PORTFOLIO_DRIFT"
  | "ENGAGEMENT_GAP"
  | "DOCUMENT_STALE"
  | "LIFE_EVENT_FOLLOWUP"
  | "TAX_DEADLINE"
  | "FEE_SCHEDULE_CHANGE"
  | "ONBOARDING_STALLED"
  | "CHURN_RISK"
  | "CASH_DRIFT"
  | "SECURITY_MATURE";

export type TriggerAction = "CREATE_TASK" | "CREATE_OPPORTUNITY" | "CREATE_FLAG" | "NOTIFY_ONLY";

export interface TriggerRule {
  id: string;
  category: TriggerCategory;
  name: string;
  description: string;
  action: TriggerAction;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  cooldownDays: number; // Minimum days between triggers for same client/category
  config: Record<string, unknown>;
}

export interface TriggerResult {
  ruleId: string;
  category: TriggerCategory;
  clientId: string;
  clientName: string;
  action: TriggerAction;
  createdId: string;
  title: string;
  description: string;
  priority: string;
  advisorNotified: boolean;
}

export interface TriggerRunResult {
  runId: string;
  organizationId: string;
  rulesEvaluated: number;
  triggersFired: number;
  actionsCreated: number;
  results: TriggerResult[];
  runDate: Date;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Built-in trigger rules
// ---------------------------------------------------------------------------

const BUILTIN_RULES: TriggerRule[] = [
  {
    id: "age_59_half",
    category: "AGE_MILESTONE",
    name: "Client Turning 59½",
    description: "Client approaching age 59½ — penalty-free IRA withdrawal eligibility. Generate RMD pre-planning task.",
    action: "CREATE_TASK",
    priority: "HIGH",
    cooldownDays: 365,
    config: { targetAge: 59.5, monthsBefore: 3 },
  },
  {
    id: "age_73_rmd",
    category: "AGE_MILESTONE",
    name: "Client Turning 73 — RMD Required",
    description: "Client approaching age 73 — SECURE Act 2.0 RMD age. Must begin Required Minimum Distributions.",
    action: "CREATE_OPPORTUNITY",
    priority: "URGENT",
    cooldownDays: 365,
    config: { targetAge: 73, monthsBefore: 6 },
  },
  {
    id: "portfolio_drift_5",
    category: "PORTFOLIO_DRIFT",
    name: "Portfolio Drift >5%",
    description: "Asset allocation has drifted more than 5% from target. Rebalance review needed.",
    action: "CREATE_OPPORTUNITY",
    priority: "MEDIUM",
    cooldownDays: 30,
    config: { driftThreshold: 5 },
  },
  {
    id: "engagement_gap_90",
    category: "ENGAGEMENT_GAP",
    name: "No Contact in 90 Days",
    description: "Client has had no outbound touchpoint in 90+ days. Fiduciary monitoring concern.",
    action: "CREATE_TASK",
    priority: "HIGH",
    cooldownDays: 30,
    config: { gapDays: 90 },
  },
  {
    id: "engagement_gap_60",
    category: "ENGAGEMENT_GAP",
    name: "No Contact in 60 Days",
    description: "Client has had no outbound touchpoint in 60+ days. Proactive outreach recommended.",
    action: "CREATE_TASK",
    priority: "MEDIUM",
    cooldownDays: 30,
    config: { gapDays: 60 },
  },
  {
    id: "document_stale_estate",
    category: "DOCUMENT_STALE",
    name: "Estate Plan >5 Years Old",
    description: "Estate planning documents are more than 5 years old. Regulatory best practice: quinquennial review.",
    action: "CREATE_FLAG",
    priority: "MEDIUM",
    cooldownDays: 365,
    config: { documentType: "ESTATE_PLAN", staleYears: 5 },
  },
  {
    id: "document_stale_trust",
    category: "DOCUMENT_STALE",
    name: "Trust Agreement >5 Years Old",
    description: "Trust agreements older than 5 years should be reviewed for relevance and compliance.",
    action: "CREATE_FLAG",
    priority: "MEDIUM",
    cooldownDays: 365,
    config: { documentType: "TRUST_AGREEMENT", staleYears: 5 },
  },
  {
    id: "life_event_no_followup",
    category: "LIFE_EVENT_FOLLOWUP",
    name: "Life Event Without Follow-up",
    description: "Life event detected but no follow-up task or communication within 14 days.",
    action: "CREATE_TASK",
    priority: "HIGH",
    cooldownDays: 30,
    config: { followupDays: 14 },
  },
  {
    id: "tax_q4_harvesting",
    category: "TAX_DEADLINE",
    name: "Q4 Tax-Loss Harvesting Window",
    description: "Approaching year-end — tax-loss harvesting window closing. Review unrealized losses.",
    action: "CREATE_OPPORTUNITY",
    priority: "HIGH",
    cooldownDays: 90,
    config: { startMonth: 10, endMonth: 12 },
  },
  {
    id: "tax_estimated_payment",
    category: "TAX_DEADLINE",
    name: "Quarterly Estimated Payment Due",
    description: "Quarterly estimated tax payment deadline approaching in 30 days.",
    action: "CREATE_TASK",
    priority: "HIGH",
    cooldownDays: 60,
    config: { daysBefore: 30 },
  },
  {
    id: "churn_risk_high",
    category: "CHURN_RISK",
    name: "High Churn Risk Detected",
    description: "Client churn score exceeds 75 — at risk of leaving. Retention outreach needed.",
    action: "CREATE_TASK",
    priority: "URGENT",
    cooldownDays: 14,
    config: { churnThreshold: 75 },
  },
  {
    id: "cash_drift_high",
    category: "CASH_DRIFT",
    name: "Excess Cash Allocation",
    description: "Cash allocation exceeds 20% of portfolio — potential investment opportunity or drag.",
    action: "CREATE_OPPORTUNITY",
    priority: "MEDIUM",
    cooldownDays: 30,
    config: { cashThreshold: 0.20 },
  },
  {
    id: "onboarding_stalled_14",
    category: "ONBOARDING_STALLED",
    name: "Onboarding Stalled >14 Days",
    description: "Client onboarding has been stuck at the same step for more than 14 days.",
    action: "CREATE_TASK",
    priority: "HIGH",
    cooldownDays: 7,
    config: { stalledDays: 14 },
  },
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ProactiveTriggersService {
  /**
   * Run all trigger rules for an organization.
   * Called by the cron endpoint on a schedule.
   */
  static async runAllTriggers(
    organizationId: string,
    userId?: string,
  ): Promise<TriggerRunResult> {
    const runId = `TRIGGER-${Date.now()}`;
    const startTime = Date.now();
    const results: TriggerResult[] = [];

    // Load organization-specific trigger rules from ComplianceRule table
    const orgRules = await prisma.complianceRule.findMany({
      where: { organizationId, category: "TRIGGER_RULE", isActive: true },
    });

    const customRules: TriggerRule[] = orgRules.map((r) => ({
      id: r.id,
      category: (r.config as any).category ?? "CUSTOM",
      name: r.name,
      description: (r.config as any).description ?? "",
      action: (r.config as any).action ?? "CREATE_TASK",
      priority: r.severity as TriggerRule["priority"],
      cooldownDays: (r.config as any).cooldownDays ?? 30,
      config: (r.config as any).config ?? {},
    }));

    const allRules = [...BUILTIN_RULES, ...customRules];

    // Load all clients with relations
    const clients = await prisma.client.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        intelligence: true,
        accounts: { include: { holdings: true } },
        documents: true,
        communications: { orderBy: { timestamp: "desc" }, take: 10 },
        events: { orderBy: { createdAt: "desc" }, take: 5 },
        tasks: { where: { isCompleted: false } },
        opportunities: { where: { status: { in: ["DRAFT", "PENDING_REVIEW"] } } },
        onboarding: { include: { steps: true } },
      },
    });

    for (const rule of allRules) {
      for (const client of clients) {
        try {
          const fired = await this.evaluateRule(rule, client, organizationId);
          if (fired) results.push(fired);
        } catch {
          // Skip individual rule failures — don't block the entire run
        }
      }
    }

    const durationMs = Date.now() - startTime;

    // Audit log
    await AuditEventService.appendEvent({
      organizationId,
      userId,
      action: "PROACTIVE_TRIGGERS_RUN",
      target: "TriggerEngine",
      details: `Trigger run: ${allRules.length} rules, ${clients.length} clients, ${results.length} triggers fired`,
      severity: "INFO",
      aiInvolved: false,
      metadata: {
        runId,
        rulesEvaluated: allRules.length,
        triggersFired: results.length,
        actionsCreated: results.length,
        durationMs,
        categories: [...new Set(results.map((r) => r.category))],
      },
    });

    return {
      runId,
      organizationId,
      rulesEvaluated: allRules.length,
      triggersFired: results.length,
      actionsCreated: results.length,
      results,
      runDate: new Date(),
      durationMs,
    };
  }

  /**
   * Evaluate a single rule against a client.
   * Returns a TriggerResult if the rule fires, null otherwise.
   */
  private static async evaluateRule(
    rule: TriggerRule,
    client: any,
    organizationId: string,
  ): Promise<TriggerResult | null> {
    // Check cooldown — skip if recently triggered for this client/category
    const cooldownStart = new Date(Date.now() - rule.cooldownDays * 24 * 60 * 60 * 1000);
    const recentTrigger = await prisma.auditLog.findFirst({
      where: {
        organizationId,
        action: "PROACTIVE_TRIGGER_FIRED",
        target: `Trigger:${rule.id}`,
        details: { contains: client.id },
        timestamp: { gte: cooldownStart },
      },
    });
    if (recentTrigger) return null;

    // Evaluate the rule condition
    const conditionMet = this.checkCondition(rule, client);
    if (!conditionMet) return null;

    // Fire the trigger — create the appropriate action
    const title = `${rule.name}: ${client.name}`;
    const description = rule.description;

    let createdId = "";
    let advisorNotified = false;

    switch (rule.action) {
      case "CREATE_TASK": {
        const task = await prisma.task.create({
          data: {
            clientId: client.id,
            title,
            description,
            priority: rule.priority === "URGENT" ? "URGENT" : rule.priority,
            source: "AI_GENERATED",
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          },
        });
        createdId = task.id;
        break;
      }
      case "CREATE_OPPORTUNITY": {
        const opp = await prisma.opportunity.create({
          data: {
            clientId: client.id,
            type: this.mapCategoryToOppType(rule.category),
            description,
            suggestedAction: `Review and take action on: ${rule.name}`,
            status: "DRAFT",
            riskLevel: rule.priority === "URGENT" ? "HIGH" : "LOW",
            confidence: 80,
          },
        });
        createdId = opp.id;
        break;
      }
      case "CREATE_FLAG": {
        const flag = await prisma.complianceFlag.create({
          data: {
            organizationId,
            type: rule.category,
            severity: rule.priority,
            description: `${description} — Client: ${client.name}`,
            target: "Client",
            targetId: client.id,
            status: "OPEN",
            aiInvolved: false,
          },
        });
        createdId = flag.id;
        break;
      }
      case "NOTIFY_ONLY": {
        createdId = `NOTIFY-${Date.now()}`;
        break;
      }
    }

    // Notify the advisor
    const advisor = await prisma.user.findFirst({
      where: { organizationId, role: { in: ["ADVISOR", "SENIOR_ADVISOR"] }, isActive: true },
    });

    if (advisor) {
      try {
        await SSENotificationService.pushToUser(advisor.id, {
          type: "PROACTIVE_TRIGGER",
          title: `🔔 ${rule.name}`,
          body: description,
          metadata: { ruleId: rule.id, clientId: client.id, category: rule.category, createdId, organizationId },
        });
        advisorNotified = true;
      } catch {
        // SSE push failure shouldn't block the trigger
      }
    }

    // Log the trigger
    await AuditEventService.appendEvent({
      organizationId,
      action: "PROACTIVE_TRIGGER_FIRED",
      target: `Trigger:${rule.id}`,
      details: `Rule "${rule.name}" fired for client ${client.name} (${client.id}). Action: ${rule.action}, Created: ${createdId}`,
      severity: rule.priority === "URGENT" ? "WARNING" : "INFO",
      aiInvolved: false,
      metadata: { ruleId: rule.id, category: rule.category, clientId: client.id, action: rule.action, createdId },
    });

    return {
      ruleId: rule.id,
      category: rule.category,
      clientId: client.id,
      clientName: client.name,
      action: rule.action,
      createdId,
      title,
      description,
      priority: rule.priority,
      advisorNotified,
    };
  }

  /**
   * Check if a rule's condition is met for a given client.
   */
  private static checkCondition(rule: TriggerRule, client: any): boolean {
    switch (rule.category) {
      case "AGE_MILESTONE": {
        // Check if client has birthDate in intelligence profile
        // For now, check lifeStage as a proxy
        const targetAge = (rule.config as any).targetAge as number;
        const monthsBefore = (rule.config as any).monthsBefore as number;
        const lifeStage = client.intelligence?.lifeStage;
        if (targetAge === 59.5 && lifeStage === "PRE_RETIREMENT") return true;
        if (targetAge === 73 && (lifeStage === "DISTRIBUTION" || lifeStage === "RETIREMENT")) return true;
        return false;
      }

      case "PORTFOLIO_DRIFT": {
        const threshold = (rule.config as any).driftThreshold as number;
        // Check if any account has target allocations that differ from actual
        for (const account of client.accounts ?? []) {
          const totalValue = account.holdings?.reduce((s: number, h: any) => s + (h.marketValue ?? 0), 0) ?? 0;
          if (totalValue === 0) continue;

          const targets: Record<string, number> = {
            equities: account.targetEquities ?? 0,
            fixedIncome: account.targetFixedIncome ?? 0,
            cash: account.targetCash ?? 0,
            alternatives: account.targetAlternatives ?? 0,
          };

          // Calculate actual allocations by asset class
          const actuals: Record<string, number> = {};
          for (const holding of account.holdings ?? []) {
            const cls = holding.assetClass?.toLowerCase() ?? "other";
            actuals[cls] = (actuals[cls] ?? 0) + (holding.marketValue ?? 0);
          }

          // Check drift
          for (const [assetClass, targetPercent] of Object.entries(targets)) {
            if (targetPercent <= 0) continue;
            const actualPercent = ((actuals[assetClass] ?? 0) / totalValue) * 100;
            const drift = Math.abs(actualPercent - targetPercent);
            if (drift > threshold) return true;
          }
        }
        return false;
      }

      case "ENGAGEMENT_GAP": {
        const gapDays = (rule.config as any).gapDays as number;
        const lastOutbound = client.communications?.find((c: any) => c.direction === "OUTBOUND");
        if (!lastOutbound) {
          // No outbound communication on record
          return client.communications?.length === 0;
        }
        const daysSince = Math.floor(
          (Date.now() - new Date(lastOutbound.timestamp).getTime()) / (1000 * 60 * 60 * 24),
        );
        return daysSince >= gapDays;
      }

      case "DOCUMENT_STALE": {
        const docType = (rule.config as any).documentType as string;
        const staleYears = (rule.config as any).staleYears as number;
        const staleDoc = client.documents?.find((d: any) => {
          if (d.documentType !== docType) return false;
          const age = (Date.now() - new Date(d.uploadedAt).getTime()) / (1000 * 60 * 60 * 24 * 365);
          return age > staleYears;
        });
        return !!staleDoc;
      }

      case "LIFE_EVENT_FOLLOWUP": {
        const followupDays = (rule.config as any).followupDays as number;
        const recentEvent = client.events?.find((e: any) => {
          const daysSince = Math.floor(
            (Date.now() - new Date(e.createdAt).getTime()) / (1000 * 60 * 60 * 24),
          );
          return daysSince > followupDays && daysSince < 60; // Only within 60 days
        });
        if (!recentEvent) return false;
        // Check if there's a follow-up task or communication
        const hasFollowup = client.tasks?.some((t: any) =>
          t.title?.includes(recentEvent.title) || t.description?.includes(recentEvent.title)
        );
        return !hasFollowup;
      }

      case "TAX_DEADLINE": {
        const currentMonth = new Date().getMonth() + 1;
        if (rule.id === "tax_q4_harvesting") {
          const startMonth = (rule.config as any).startMonth as number;
          const endMonth = (rule.config as any).endMonth as number;
          return currentMonth >= startMonth && currentMonth <= endMonth;
        }
        if (rule.id === "tax_estimated_payment") {
          // Estimated payment months: 4 (Apr), 6 (Jun), 9 (Sep), 1 (Jan next year)
          const estimatedMonths = [4, 6, 9, 1];
          const daysBefore = (rule.config as any).daysBefore as number;
          return estimatedMonths.some((m) => {
            const targetDate = new Date(new Date().getFullYear(), m - 1, 15);
            const daysUntil = Math.floor((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return daysUntil > 0 && daysUntil <= daysBefore;
          });
        }
        return false;
      }

      case "CHURN_RISK": {
        const threshold = (rule.config as any).churnThreshold as number;
        return (client.churnScore ?? 0) >= threshold;
      }

      case "CASH_DRIFT": {
        const cashThreshold = (rule.config as any).cashThreshold as number;
        for (const account of client.accounts ?? []) {
          const totalValue = account.holdings?.reduce((s: number, h: any) => s + (h.marketValue ?? 0), 0) ?? 0;
          if (totalValue === 0) continue;
          const cashValue = account.cashBalance ?? 0;
          const cashPercent = cashValue / (totalValue + cashValue);
          if (cashPercent > cashThreshold) return true;
        }
        return false;
      }

      case "ONBOARDING_STALLED": {
        const stalledDays = (rule.config as any).stalledDays as number;
        if (!client.onboarding) return false;
        const onboardingAge = Math.floor(
          (Date.now() - new Date(client.onboarding.createdAt).getTime()) / (1000 * 60 * 60 * 24),
        );
        if (onboardingAge < stalledDays) return false;
        // Check if any step has been stuck
        const hasStuckStep = client.onboarding.steps?.some((s: any) => {
          if (s.status === "COMPLETED") return false;
          const stepAge = s.completedAt
            ? 0
            : Math.floor((Date.now() - new Date(client.onboarding.createdAt).getTime()) / (1000 * 60 * 60 * 24));
          return stepAge > stalledDays;
        });
        return !!hasStuckStep;
      }

      case "FEE_SCHEDULE_CHANGE": {
        // Check if AUM has crossed a tier boundary
        // Simplified: check if AUM changed significantly
        const totalAum = client.aum ?? 0;
        if (totalAum === 0) return false;
        // This would need historical AUM tracking to be fully accurate
        return false;
      }

      case "SECURITY_MATURE": {
        // Check for bonds/CDs approaching maturity
        const now = new Date();
        const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        for (const account of client.accounts ?? []) {
          for (const holding of account.holdings ?? []) {
            const name = (holding.name ?? "").toLowerCase();
            if (name.includes("bond") || name.includes("cd") || name.includes("maturity") || name.includes("note")) {
              // Would need maturity date tracking to be precise
              // For now, flag if the holding name suggests a fixed-income security
              return true;
            }
          }
        }
        return false;
      }

      default:
        return false;
    }
  }

  /**
   * Map trigger category to opportunity type.
   */
  private static mapCategoryToOppType(category: TriggerCategory): string {
    const mapping: Record<TriggerCategory, string> = {
      AGE_MILESTONE: "RMD",
      PORTFOLIO_DRIFT: "REBALANCE",
      ENGAGEMENT_GAP: "CROSS_SELL",
      DOCUMENT_STALE: "ESTATE",
      LIFE_EVENT_FOLLOWUP: "CROSS_SELL",
      TAX_DEADLINE: "TLH",
      FEE_SCHEDULE_CHANGE: "CROSS_SELL",
      ONBOARDING_STALLED: "CROSS_SELL",
      CHURN_RISK: "CROSS_SELL",
      CASH_DRIFT: "IDLE_CASH",
      SECURITY_MATURE: "ROLLOVER",
    };
    return mapping[category] ?? "CROSS_SELL";
  }

  /**
   * Get a summary of recent trigger activity.
   */
  static async getTriggerSummary(organizationId: string): Promise<{
    lastRunDate: Date | null;
    totalTriggersFired: number;
    byCategory: Record<string, number>;
    recentResults: TriggerResult[];
  }> {
    const recentEvents = await AuditEventService.queryEvents({
      organizationId,
      action: "PROACTIVE_TRIGGERS_RUN",
      limit: 1,
    });

    const lastRunDate = recentEvents[0]?.timestamp ?? null;
    const lastMetadata = recentEvents[0]?.metadata as any;
    const totalTriggersFired = lastMetadata?.triggersFired ?? 0;

    // Get recent trigger fires
    const triggerEvents = await AuditEventService.queryEvents({
      organizationId,
      action: "PROACTIVE_TRIGGER_FIRED",
      limit: 50,
    });

    const byCategory: Record<string, number> = {};
    const recentResults: TriggerResult[] = triggerEvents.map((e) => {
      const m = e.metadata as any;
      const cat = m?.category ?? "UNKNOWN";
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      return {
        ruleId: m?.ruleId ?? "",
        category: cat,
        clientId: m?.clientId ?? "",
        clientName: e.details?.split("client ")[1]?.split(" (")[0] ?? "",
        action: m?.action ?? "NOTIFY_ONLY",
        createdId: m?.createdId ?? "",
        title: e.details?.split(". ")[0] ?? "",
        description: e.details ?? "",
        priority: e.severity === "WARNING" ? "URGENT" : "MEDIUM",
        advisorNotified: true,
      };
    });

    return { lastRunDate, totalTriggersFired, byCategory, recentResults };
  }

  /**
   * Create a custom trigger rule for an organization.
   */
  static async createCustomRule(
    organizationId: string,
    rule: Omit<TriggerRule, "id">,
    userId: string,
  ): Promise<string> {
    const created = await prisma.complianceRule.create({
      data: {
        organizationId,
        name: rule.name,
        type: rule.category,
        category: "TRIGGER_RULE",
        severity: rule.priority,
        isActive: true,
        autoEscalate: rule.priority === "URGENT",
        config: {
          category: rule.category,
          description: rule.description,
          action: rule.action,
          cooldownDays: rule.cooldownDays,
          config: rule.config,
        } as any,
      },
    });

    await AuditEventService.appendEvent({
      organizationId,
      userId,
      action: "CUSTOM_TRIGGER_CREATED",
      target: `TriggerRule:${rule.name}`,
      details: `Custom trigger rule "${rule.name}" created: ${rule.category}, ${rule.action}`,
      severity: "INFO",
      metadata: { ruleId: created.id, category: rule.category },
    });

    return created.id;
  }
}
