"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db";
import { MeetingService } from "@/lib/services/meeting.service";
import { DocumentService } from "@/lib/services/document.service";
import { AuditService } from "@/lib/services/audit.service";
import { SecurityService, SecurityContext } from "@/lib/services/security.service";
import { getSecurityContextFromSession } from "@/lib/auth";

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
// SYSTEM ACTIONS (PULLING FROM HARDENED SERVICES)
// --------------------------------------------------

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

  const [clients] = await Promise.all([
    prisma.client.findMany({ 
      where: { 
        name: { contains: query },
        organizationId: ctx.organizationId
      }, 
      take: 5, 
      select: { id: true, name: true, type: true } 
    })
  ]);

  return { clients, prospects: [] };
}

// --------------------------------------------------
// DOCUMENT & COMPLIANCE GOVERNANCE
// --------------------------------------------------

export async function processDocument(id: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await DocumentService.processDocument(id, ctx.organizationId);
  revalidatePath("/vault");
}

export async function markDocumentReviewed(id: string) {
  const ctx = await getSecurityContext();
  if (!ctx) throw new Error("Unauthenticated");
  await SecurityService.enforceAccess(ctx, 'CLIENT_WRITE', `Document:${id}`);

  await prisma.document.update({ 
    where: { id, client: { organizationId: ctx.organizationId } }, 
    data: { status: "REVIEWED" } 
  });
  
  revalidatePath("/vault");
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
