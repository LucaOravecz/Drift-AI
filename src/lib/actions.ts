"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db";
import { MeetingService } from "@/lib/services/meeting.service";
import { CommunicationService } from "@/lib/services/communication.service";
import { ResearchService } from "@/lib/services/research.service";
import { TaxService } from "@/lib/services/tax.service";
import { DocumentService } from "@/lib/services/document.service";
import { AuditService } from "@/lib/services/audit.service";
import { SecurityService, SecurityContext } from "@/lib/services/security.service";
import { getSecurityContextFromSession } from "@/lib/auth";
import { detectClientOpportunities } from "@/lib/engines/opportunity.engine";
import { ClientMemoryService } from "@/lib/services/client-memory.service";
import { IntegrationService } from "@/lib/services/integration.service";
import { PortfolioService } from "@/lib/services/portfolio.service";
import { 
  TaxInsightReviewSchema
} from "@/lib/validations/schema";

function hasMessage(error: unknown): error is { message: string } {
  return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string";
}

/**
 * Institutional Role-based Context Retrieval.
 * SOC 2: Identity is the first line of defense.
 */
async function getSecurityContext(): Promise<SecurityContext | null> {
  return getSecurityContextFromSession();
}

async function getOrgId(): Promise<string> {
  const org = await prisma.organization.findFirst();
  return org?.id ?? "";
}

// --------------------------------------------------
// REVENUE & OPPORTUNITY GOVERNANCE
// --------------------------------------------------

export async function dismissOpportunity(id: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");

  await SecurityService.enforceAccess(ctx, 'CLIENT_WRITE', `Opportunity:${id}`);

  const before = await prisma.opportunity.findUnique({ where: { id, client: { organizationId: ctx.organizationId } } });
  if (!before) throw new Error("Not Found");

  const after = await prisma.opportunity.update({ 
    where: { id }, 
    data: { status: "REJECTED" } 
  });

  await AuditService.logAction({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "OPPORTUNITY_DISMISSED",
    target: `Opportunity:${id}`,
    beforeState: before,
    afterState: after,
    severity: "INFO",
    aiInvolved: true
  });

  revalidatePath("/"); revalidatePath("/opportunities");
}

export async function approveOpportunity(rawId: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");

  const before = await prisma.opportunity.findUnique({ 
    where: { id: rawId, client: { organizationId: ctx.organizationId } } 
  });
  if (!before) throw new Error("Not Found");

  const isHighValue = (before.valueEst ?? 0) >= 1000000;
  
  try {
    if (isHighValue) {
      await SecurityService.enforceAccess(ctx, 'OPPORTUNITY_APPROVE_HIGH', `HighValueOpp:${rawId}`);
    } else {
      await SecurityService.enforceAccess(ctx, 'CLIENT_WRITE', `Opportunity:${rawId}`);
    }
  } catch (error: unknown) {
    if (isHighValue && hasMessage(error) && error.message.includes("Security Violation")) {
      // Institutional Escalation Path: Move to PENDING_REVIEW instead of crashing
      await prisma.opportunity.update({ 
        where: { id: rawId }, 
        data: { status: "PENDING_REVIEW" } 
      });

      await AuditService.logAction({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "OPPORTUNITY_ESCALATED",
        target: before.clientId,
        metadata: { reason: "Advisor lacks high-value approval capability", dealValue: before.valueEst },
        severity: "WARNING",
        aiInvolved: false
      });

      revalidatePath("/"); revalidatePath("/opportunities");
      return { success: false, escalated: true, message: "Deal >$1M requires Senior Advisor approval. Escalated to Review Queue." };
    }
    throw error;
  }

  const after = await prisma.opportunity.update({ 
    where: { id: rawId }, 
    data: { status: "APPROVED" },
    include: { client: true }
  });

  await prisma.task.create({
    data: {
      userId: ctx.userId,
      clientId: after.clientId,
      title: `Execute Opportunity: ${after.type}`,
      description: `Approved by ${ctx.role}. Ancestry: OPP_${rawId}`,
      priority: "HIGH",
      source: "AI_GENERATED",
    }
  });

  await AuditService.logAction({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "OPPORTUNITY_APPROVED",
    target: after.client.name,
    beforeState: before,
    afterState: after,
    severity: isHighValue ? "WARNING" : "INFO",
    aiInvolved: true
  });
  
  revalidatePath("/"); revalidatePath("/opportunities");
  return { success: true };
}

// --------------------------------------------------
// TAX GOVERNANCE
// --------------------------------------------------

export async function reviewTaxInsight(id: string, action: string) {
  try {
    const ctx = await getSecurityContext();
    if (!ctx) throw new Error("Unauthenticated");

    const validated = TaxInsightReviewSchema.parse({ id, action });
    await SecurityService.enforceAccess(ctx, 'CLIENT_WRITE', `TaxInsight:${id}`);

    const before = await prisma.taxInsight.findUnique({ where: { id, client: { organizationId: ctx.organizationId } } });
    if (!before) throw new Error("Not Found");

    const after = await prisma.taxInsight.update({ 
      where: { id }, 
      data: { 
        status: validated.action === "ACCEPTED" ? "ACCEPTED" : validated.action,
        reviewedBy: ctx.userId, 
        reviewedAt: new Date() 
      }, 
      include: { client: true } 
    });
    
    await AuditService.logAction({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "TAX_INSIGHT_REVIEW",
      target: after.client.name,
      beforeState: before,
      afterState: after,
      severity: "INFO",
      aiInvolved: true
    });
    
    revalidatePath("/tax");
    return { success: true };
  } catch (error: unknown) {
    if (hasMessage(error) && error.message.includes("Security Violation")) {
      return { success: false, error: "Unauthorized: Senior role required for this tax review." };
    }
    throw error;
  }
}

// --------------------------------------------------
// COMMUNICATION GOVERNANCE
// --------------------------------------------------

export async function approveCommunication(id: string) {
  try {
    const ctx = await getSecurityContext();
    if (!ctx) throw new Error("Unauthenticated");

    await SecurityService.enforceAccess(ctx, 'COMMUNICATION_APPROVE', `Comm:${id}`);

    const before = await prisma.communication.findUnique({ where: { id, client: { organizationId: ctx.organizationId } } });
    const after = await prisma.communication.update({ 
      where: { id }, 
      data: { status: "APPROVED", approverId: ctx.userId } 
    });

    await AuditService.logAction({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "COMMUNICATION_APPROVED",
      target: `Comm:${id}`,
      beforeState: before,
      afterState: after,
      severity: "INFO"
    });

    revalidatePath("/communications");
    return { success: true };
  } catch (error: unknown) {
    if (hasMessage(error) && error.message.includes("Security Violation")) {
      return { success: false, error: "Unauthorized: Compliance or Senior role required for communication approval." };
    }
    throw error;
  }
}

export async function sendCommunication(id: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");

  // Multi-layer check: Service already checks APPROVED status, Action checks Capability.
  await SecurityService.enforceAccess(ctx, 'COMMUNICATION_SEND', `Comm:${id}`);

  await CommunicationService.sendEmail(id, ctx);

  revalidatePath("/communications");
}

// --------------------------------------------------
// SYSTEM ACTIONS (PULLING FROM HARDENED SERVICES)
// --------------------------------------------------

export async function runTaxScan() {
  const orgId = await getOrgId();
  return TaxService.runTaxScan(orgId);
}

export async function generateCommunicationDraft(clientId: string, type: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  return CommunicationService.generateDraft(clientId, type, ctx);
}

export async function bulkProcessComplianceItems(
  items: { id: string; source: string }[],
  action: "APPROVE" | "REJECT" | "RESOLVE"
) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await SecurityService.enforceAccess(ctx, "COMPLIANCE_RESOLVE", "BulkReview");

  let count = 0;
  for (const item of items) {
    try {
      switch (item.source) {
        case "COMMUNICATION":
          await prisma.communication.update({
            where: { id: item.id, client: { organizationId: ctx.organizationId } },
            data: { 
              status: action === "APPROVE" ? "APPROVED" : "REJECTED",
              approverId: ctx.userId,
              sentAt: action === "APPROVE" ? new Date() : null
            },
          });
          break;
        case "TAX":
          await prisma.taxInsight.update({
            where: { id: item.id, client: { organizationId: ctx.organizationId } },
            data: { 
              status: action === "APPROVE" ? "ACCEPTED" : "DISMISSED",
              reviewedBy: ctx.userId,
              reviewedAt: new Date()
            },
          });
          break;
        case "OPPORTUNITY":
          await prisma.opportunity.update({
            where: { id: item.id, client: { organizationId: ctx.organizationId } },
            data: { status: action === "APPROVE" ? "APPROVED" : "REJECTED" },
          });
          break;
        case "INVESTMENT":
          await prisma.investmentInsight.update({
            where: { id: item.id, client: { organizationId: ctx.organizationId } },
            data: { status: action === "APPROVE" ? "REVIEWED" : "DISMISSED" },
          });
          break;
        case "FLAG":
          await prisma.complianceFlag.update({
            where: { id: item.id, organizationId: ctx.organizationId },
            data: { 
              status: action === "APPROVE" || action === "RESOLVE" ? "RESOLVED" : "DISMISSED",
              reviewedBy: ctx.userId,
              resolvedAt: new Date()
            },
          });
          break;
        case "RESEARCH":
          await prisma.researchMemo.update({
            where: { id: item.id, client: { organizationId: ctx.organizationId } },
            data: { status: action === "APPROVE" ? "APPROVED" : "ARCHIVED" },
          });
          break;
      }
      count++;
    } catch (e) {
      console.error(`Bulk failure for ${item.source}:${item.id}`, e);
    }
  }

  await AuditService.logAction({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "BULK_COMPLIANCE_REVIEW",
    target: "ComplianceDashboard",
    details: `Processed ${count} items in bulk. Action: ${action}`,
    severity: "INFO",
  });

  revalidatePath("/compliance");
  return { success: true, processed: count };
}

export async function completeTask(id: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");

  const before = await prisma.task.findUnique({ where: { id, user: { organizationId: ctx.organizationId } } });
  const after = await prisma.task.update({ where: { id }, data: { isCompleted: true, completedAt: new Date() } });

  await AuditService.logAction({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "TASK_COMPLETED",
    target: `Task:${id}`,
    beforeState: before,
    afterState: after,
    severity: "INFO"
  });

  revalidatePath("/");
}

export async function globalSearch(query: string) {
  if (!query) return { clients: [], prospects: [] };
  const ctx = await getSecurityContext();
  if (!ctx) return { clients: [], prospects: [] };

  const [clients, prospects] = await Promise.all([
    prisma.client.findMany({ 
      where: { 
        name: { contains: query },
        organizationId: ctx.organizationId
      }, 
      take: 5, 
      select: { id: true, name: true, type: true } 
    }),
    prisma.prospect.findMany({ 
      where: { 
        name: { contains: query },
        organizationId: ctx.organizationId
      }, 
      take: 5, 
      select: { id: true, name: true, stage: true } 
    })
  ]);

  return { clients, prospects };
}

// --------------------------------------------------
// RESEARCH & INVESTMENT GOVERNANCE
// --------------------------------------------------

export async function generateResearchMemo(clientId: string, topic: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await SecurityService.enforceAccess(ctx, 'AI_GENERATION', 'ResearchMemoGen');
  return ResearchService.generateMemo(clientId, topic, ctx.organizationId);
}

export async function runPortfolioScan() {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await SecurityService.enforceAccess(ctx, 'CLIENT_VIEW', 'PortfolioScan');

  const results = await PortfolioService.runGlobalPortfolioScan(ctx.organizationId);
  const created = results.filter((result) => result?.status === 'FINDINGS_CREATED').length;

  await prisma.notification.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      type: 'PORTFOLIO',
      title: created > 0 ? 'Portfolio scan created findings' : 'Portfolio scan complete',
      body: created > 0
        ? `${created} client portfolio(s) produced explainable findings from stored holdings data.`
        : 'No holdings-based findings exceeded policy thresholds.',
      link: '/research',
    },
  });

  revalidatePath('/research');
  revalidatePath('/opportunities');
  return { created };
}

export async function approveMemo(id: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await SecurityService.enforceAccess(ctx, 'COMMUNICATION_APPROVE', `ResearchMemo:${id}`);

  const before = await prisma.researchMemo.findUnique({ where: { id, client: { organizationId: ctx.organizationId } } });
  const after = await prisma.researchMemo.update({ 
    where: { id }, 
    data: { status: "APPROVED" } 
  });

  await AuditService.logAction({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "RESEARCH_MEMO_APPROVED",
    target: `ResearchMemo:${id}`,
    beforeState: before,
    afterState: after,
    severity: "INFO"
  });

  revalidatePath("/research");
}

export async function reviewInvestmentInsight(id: string, action: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await SecurityService.enforceAccess(ctx, 'CLIENT_WRITE', `InvestmentInsight:${id}`);

  await prisma.investmentInsight.update({ 
    where: { id, client: { organizationId: ctx.organizationId } }, 
    data: { status: action } 
  });

  revalidatePath("/research");
}

// --------------------------------------------------
// DOCUMENT & COMPLIANCE GOVERNANCE
// --------------------------------------------------

export async function processDocument(id: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await DocumentService.processDocument(id, ctx.organizationId);
  revalidatePath("/documents");
}

export async function markDocumentReviewed(id: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await SecurityService.enforceAccess(ctx, 'CLIENT_WRITE', `Document:${id}`);

  await prisma.document.update({ 
    where: { id, client: { organizationId: ctx.organizationId } }, 
    data: { status: "REVIEWED" } 
  });
  
  revalidatePath("/documents");
}

export async function resolveComplianceFlag(id: string) {
  try {
    const ctx = await getSecurityContext();
    if (!ctx) throw new Error("Unauthenticated");
    await SecurityService.enforceAccess(ctx, 'COMPLIANCE_RESOLVE', `ComplianceFlag:${id}`);

    await prisma.complianceFlag.update({ 
      where: { id, organizationId: ctx.organizationId }, 
      data: { status: "RESOLVED", resolvedAt: new Date(), reviewedBy: ctx.userId } 
    });

    revalidatePath("/compliance");
    return { success: true };
  } catch (error: unknown) {
    if (hasMessage(error) && error.message.includes("Security Violation")) {
      return { success: false, error: "Unauthorized: Compliance Officer role required." };
    }
    throw error;
  }
}

export async function generateMeetingBrief(meetingId: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await MeetingService.generateBrief(meetingId);
  await prisma.notification.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      type: "MEETING",
      title: "Meeting brief generated",
      body: "A grounded meeting brief was generated and saved to the meeting record.",
      link: "/meetings",
    },
  });
  revalidatePath("/meetings");
}

export async function advanceOnboardingStep(stepId: string) {
  try {
    const ctx = await getSecurityContext();
    if (!ctx) throw new Error("Unauthenticated");
    
    await SecurityService.enforceAccess(ctx, 'ONBOARDING_MANAGE', `OnboardingStep:${stepId}`);
    
    const orgId = ctx.organizationId;
    const step = await prisma.onboardingStep.update({ 
      where: { id: stepId, workflow: { client: { organizationId: orgId } } }, 
      data: { status: "COMPLETED", completedAt: new Date() }, 
      include: { workflow: { include: { client: true } } } 
    });
    
    const allSteps = await prisma.onboardingStep.findMany({ where: { workflowId: step.workflowId } });
    const allComplete = allSteps.every((s: { status: string }) => s.status === "COMPLETED");
    if (allComplete) {
      await prisma.onboardingWorkflow.update({ where: { id: step.workflowId }, data: { stage: "COMPLETE", healthScore: 100 } });
    } else {
      const completedCount = allSteps.filter((s: { status: string }) => s.status === "COMPLETED").length;
      await prisma.onboardingWorkflow.update({ where: { id: step.workflowId }, data: { healthScore: Math.round((completedCount / allSteps.length) * 100) } });
    }
    
    await AuditService.logAction({ 
      organizationId: orgId, 
      action: "ONBOARDING_STEP_COMPLETED", 
      target: `Workflow:${step.workflowId}`, 
      metadata: { stepName: step.name },
      severity: "INFO" 
    });
    
    revalidatePath("/onboarding");
    return { success: true };
  } catch (error: unknown) {
    if (hasMessage(error) && error.message.includes("Security Violation")) {
      return { success: false, error: "Unauthorized: Senior Role required for onboarding management." };
    }
    throw error;
  }
}

export async function dismissAlert(id: string, type: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  
  await AuditService.logAction({ 
    organizationId: ctx.organizationId, 
    action: "ALERT_DISMISSED", 
    target: `${type}:${id}`, 
    metadata: { type, id },
    severity: "INFO" 
  });
}

// --------------------------------------------------
// INSTITUTIONAL TOPOLOGY & AUDIT
// --------------------------------------------------

export async function getHouseholdTopology(clientId: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");

  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: ctx.organizationId }
  });

  if (!client || !client.householdId) return { household: null, members: [] };

  const members = await prisma.client.findMany({
    where: { householdId: client.householdId, organizationId: ctx.organizationId },
    select: { id: true, name: true, type: true, aum: true, lastContactAt: true }
  });

  return { 
    householdId: client.householdId,
    members 
  };
}

export async function getAuditTrail(targetId?: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");

  return prisma.auditLog.findMany({
    where: { 
      organizationId: ctx.organizationId,
      ...(targetId ? { OR: [{ target: targetId }, { details: { contains: targetId } }] } : {})
    },
    orderBy: { timestamp: "desc" },
    take: 50,
    include: { user: { select: { name: true, role: true } } }
  });
}

export async function unblockOnboardingStep(stepId: string) {
  try {
    const ctx = await getSecurityContext();
    if (!ctx) throw new Error("Unauthenticated");

    await SecurityService.enforceAccess(ctx, 'ONBOARDING_MANAGE', `OnboardingStep:${stepId}`);

    const orgId = ctx.organizationId;
    const after = await prisma.onboardingStep.update({
      where: { id: stepId, workflow: { client: { organizationId: orgId } } },
      data: { status: "PENDING" },
      include: { workflow: { include: { client: true } } }
    });

    await AuditService.logAction({
      organizationId: orgId,
      userId: ctx.userId,
      action: "ONBOARDING_STEP_UNBLOCKED",
      target: after.workflow.client.name,
      details: `Step "${after.name}" reset to pending.`,
      severity: "INFO",
    });

    revalidatePath("/onboarding");
    return { success: true };
  } catch (error: unknown) {
    if (hasMessage(error) && error.message.includes("Security Violation")) {
      return { success: false, error: "Unauthorized: Senior Role required to resolve onboarding blocks." };
    }
    throw error;
  }
}

export async function advanceProspectStage(id: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await SecurityService.enforceAccess(ctx, 'CLIENT_WRITE', `Prospect:${id}`);

  const stageOrder = ["LEAD", "QUALIFIED", "DISCOVERY", "PROPOSAL", "NEGOTIATION", "CLOSED_WON"];
  const prospect = await prisma.prospect.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!prospect) throw new Error("Prospect not found");
  const currentIdx = stageOrder.indexOf(prospect.stage);
  const nextStage =
    currentIdx >= 0 && currentIdx < stageOrder.length - 1
      ? stageOrder[currentIdx + 1]
      : prospect.stage;
  await prisma.prospect.update({
    where: { id },
    data: { stage: nextStage, lastTouchAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "PROSPECT_STAGE_ADVANCED",
      target: `Prospect:${id}`,
      details: `Prospect "${prospect.name}" advanced from ${prospect.stage} to ${nextStage}.`,
      severity: "INFO",
    },
  });
  revalidatePath("/sales");
}

export async function dismissComplianceFlag(id: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await SecurityService.enforceAccess(ctx, 'COMPLIANCE_RESOLVE', `ComplianceFlag:${id}`);

  await prisma.complianceFlag.update({
    where: { id, organizationId: ctx.organizationId },
    data: { status: "DISMISSED", resolvedAt: new Date(), reviewedBy: ctx.userId },
  });
  await prisma.auditLog.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "COMPLIANCE_FLAG_DISMISSED",
      target: `ComplianceFlag:${id}`,
      details: "Advisor dismissed compliance flag.",
      severity: "INFO",
    },
  });
  revalidatePath("/compliance");
}

export async function scanClientOpportunities() {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");

  const clients = await prisma.client.findMany({
    where: { organizationId: ctx.organizationId },
    select: { id: true, name: true },
  });

  let created = 0;
  const createdTargets: string[] = [];

  for (const client of clients) {
    const detected = await detectClientOpportunities(client.id);
    for (const signal of detected) {
      const existing = await prisma.opportunity.findFirst({
        where: {
          clientId: client.id,
          type: signal.type,
          suggestedAction: signal.suggestedAction,
          status: { not: "REJECTED" },
        },
      });

      if (existing) continue;

      await prisma.opportunity.create({
        data: {
          clientId: client.id,
          type: signal.type,
          valueEst: null,
          confidence: signal.confidence === "HIGH" ? 92 : signal.confidence === "MEDIUM" ? 78 : 62,
          description: `${signal.title}. Triggered by rule: ${signal.triggerRule}.`,
          evidence: signal.triggerData,
          reasoning: JSON.stringify({
            triggerRule: signal.triggerRule,
            evidence: signal.evidence,
            missingData: signal.missingData,
          }),
          suggestedAction: signal.suggestedAction,
          status: "DRAFT",
          riskLevel: signal.urgency === "HIGH" ? "HIGH" : "LOW",
        },
      });

      created += 1;
      createdTargets.push(`${client.name}:${signal.type}`);
    }
  }

  await prisma.auditLog.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "DETERMINISTIC_OPPORTUNITY_SCAN",
      target: `Organization:${ctx.organizationId}`,
      details: created > 0
        ? `Created ${created} grounded opportunity record(s): ${createdTargets.join(", ")}`
        : "Deterministic opportunity scan completed with no new grounded opportunities.",
      severity: "INFO",
      aiInvolved: false,
    },
  });

  await prisma.notification.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      type: "OPPORTUNITY",
      title: created > 0 ? "Opportunity scan completed" : "Opportunity scan found no new signals",
      body: created > 0
        ? `${created} grounded opportunity record(s) were created from stored client data.`
        : "No new deterministic opportunities were triggered by current stored data.",
      link: "/opportunities",
    },
  });

  revalidatePath("/");
  revalidatePath("/opportunities");
  return { created };
}

export async function sendRelationshipOutreach(id: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await SecurityService.enforceAccess(ctx, 'COMMUNICATION_SEND', `RelationshipEvent:${id}`);

  const event = await prisma.relationshipEvent.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!event || event.client.organizationId !== ctx.organizationId) throw new Error("Relationship event not found");
  await prisma.relationshipEvent.update({
    where: { id },
    data: { status: "OUTREACH_SENT" },
  });
  await prisma.auditLog.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "RELATIONSHIP_OUTREACH_SENT",
      target: `RelationshipEvent:${id}`,
      details: `Outreach sent for "${event.title}" — client: ${event.client.name}.`,
      severity: "INFO",
    },
  });
  revalidatePath("/communications");
}

export async function refreshClientMemory(clientId: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");

  await SecurityService.enforceAccess(ctx, "CLIENT_VIEW", `Client:${clientId}`);
  const result = await ClientMemoryService.refreshSnapshot(clientId);

  await prisma.notification.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      type: "CLIENT_MEMORY",
      title: "Client memory refreshed",
      body: `A new deterministic client memory snapshot was stored with ${result.profile.dataQuality} data quality.`,
      link: `/clients/${clientId}`,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { success: true, dataQuality: result.profile.dataQuality };
}

export async function completeRelationshipEvent(id: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await SecurityService.enforceAccess(ctx, 'CLIENT_WRITE', `RelationshipEvent:${id}`);

  await prisma.relationshipEvent.update({
    where: { id },
    data: { status: "COMPLETED" },
  });
  await prisma.auditLog.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "RELATIONSHIP_EVENT_COMPLETED",
      target: `RelationshipEvent:${id}`,
      details: "Relationship event marked as completed.",
      severity: "INFO",
    },
  });
  revalidatePath("/communications");
}
export async function syncCalendar() {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  const result = await IntegrationService.syncCalendar(ctx);

  revalidatePath("/meetings");
  return { success: true, imported: result.imported };
}

const CLIENT_UPDATABLE_FIELDS = [
  'name', 'email', 'phone', 'type', 'riskProfile', 'householdId',
  'aum', 'notes', 'lastContactAt', 'tags', 'status',
] as const;

export async function updateClient(id: string, data: Record<string, unknown>) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");

  await SecurityService.enforceAccess(ctx, "CLIENT_WRITE", `Client:${id}`);

  const filteredData: Record<string, unknown> = {};
  for (const key of CLIENT_UPDATABLE_FIELDS) {
    if (key in data) {
      filteredData[key] = data[key];
    }
  }

  const before = await prisma.client.findUnique({ where: { id, organizationId: ctx.organizationId } });
  const after = await prisma.client.update({
    where: { id },
    data: filteredData,
  });

  await AuditService.logAction({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "CLIENT_UPDATED",
    target: after.name,
    beforeState: before,
    afterState: after,
    severity: "INFO",
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { success: true };
}

export async function createTask(clientId: string, title: string, priority: string = "MEDIUM") {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");

  await SecurityService.enforceAccess(ctx, "CLIENT_WRITE", `Client:${clientId}`);

  const task = await prisma.task.create({
    data: {
      userId: ctx.userId,
      clientId,
      title,
      priority,
      source: "MANUAL",
    },
    include: { client: true },
  });

  await AuditService.logAction({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "TASK_CREATED",
    target: task.client?.name ?? "General",
    details: `Manual task created: ${title}`,
    afterState: task,
    severity: "INFO",
  });

  revalidatePath("/");
  revalidatePath(`/clients/${clientId}`);
}

export async function markClientReviewed(clientId: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");

  await SecurityService.enforceAccess(ctx, "CLIENT_WRITE", `Client:${clientId}`);

  const client = await prisma.client.update({
    where: { id: clientId },
    data: { lastContactAt: new Date() },
  });

  await AuditService.logAction({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "CLIENT_REVIEW_COMPLETED",
    target: client.name,
    details: "Advisor completed full manual review of client profile and intelligence.",
    severity: "INFO",
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}

export async function dismissCommunication(id: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");

  await SecurityService.enforceAccess(ctx, "COMMUNICATION_APPROVE", `Comm:${id}`);

  const before = await prisma.communication.findUnique({ where: { id, client: { organizationId: ctx.organizationId } } });
  const after = await prisma.communication.update({
    where: { id },
    data: { status: "REJECTED" },
  });

  await AuditService.logAction({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "COMMUNICATION_REJECTED",
    target: `Comm:${id}`,
    beforeState: before,
    afterState: after,
    severity: "INFO",
  });

  revalidatePath("/communications");
  return { success: true };
}

export async function createNewOnboarding(clientId: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");

  await SecurityService.enforceAccess(ctx, "ONBOARDING_MANAGE", `Client:${clientId}`);

  // Check if existing onboarding exists
  const existing = await prisma.onboardingWorkflow.findUnique({ where: { clientId } });
  if (existing) return { success: false, error: "Onboarding already in progress for this client." };

  const workflow = await prisma.onboardingWorkflow.create({
    data: {
      clientId,
      stage: "DISCOVERY",
      healthScore: 80,
      steps: {
        create: [
          { name: "Discovery Call", status: "PENDING" },
          { name: "Risk Profiling", status: "PENDING" },
          { name: "Document Collection", status: "PENDING" },
        ],
      },
    },
    include: { client: true },
  });

  await AuditService.logAction({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "ONBOARDING_INITIALIZED",
    target: workflow.client.name,
    details: "New institutional onboarding workflow started.",
    severity: "INFO",
  });

  revalidatePath("/onboarding");
  return { success: true };
}

// --------------------------------------------------
// AGENT COMMAND CENTER
// --------------------------------------------------

import { AgentService } from "@/lib/services/agent.service";

export async function runAgent(agentId: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await SecurityService.enforceAccess(ctx, 'AI_GENERATION', `Agent:${agentId}`);
  const result = await AgentService.runAgent(agentId, ctx.organizationId);
  revalidatePath("/agents");
  return result;
}

export async function pauseAgent(agentId: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await SecurityService.enforceAccess(ctx, 'AI_GENERATION', `Agent:${agentId}`);
  const result = await AgentService.pauseAgent(agentId, ctx.organizationId);
  revalidatePath("/agents");
  return result;
}

export async function resumeAgent(agentId: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await SecurityService.enforceAccess(ctx, 'AI_GENERATION', `Agent:${agentId}`);
  const result = await AgentService.resumeAgent(agentId, ctx.organizationId);
  revalidatePath("/agents");
  return result;
}

export async function approveAgentOutput(outputId: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await SecurityService.enforceAccess(ctx, 'COMMUNICATION_APPROVE', `AgentOutput:${outputId}`);
  const result = await AgentService.approveOutput(outputId, ctx.organizationId);
  revalidatePath("/agents");
  return result;
}

export async function dismissAgentOutput(outputId: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await SecurityService.enforceAccess(ctx, 'COMMUNICATION_APPROVE', `AgentOutput:${outputId}`);
  const result = await AgentService.dismissOutput(outputId, ctx.organizationId);
  revalidatePath("/agents");
  return result;
}
