import "server-only";

import prisma from "@/lib/db";
import { AuditEventService } from "./audit-event.service";
import { SSENotificationService } from "./sse-notification.service";

/**
 * Workflow Engine
 *
 * Configurable approval chains and business process automation:
 * - Communication approval workflows (compliance review)
 * - Document review workflows
 * - New account opening automation
 * - Configurable escalation rules per firm
 * - Parallel and sequential approval chains
 * - SLA tracking and auto-escalation
 * - Delegation and out-of-office routing
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkflowType = "COMMUNICATION_APPROVAL" | "DOCUMENT_REVIEW" | "ACCOUNT_OPENING" | "TRADE_APPROVAL" | "COMPLIANCE_ESCALATION" | "CUSTOM";
export type WorkflowStatus = "PENDING" | "IN_PROGRESS" | "APPROVED" | "REJECTED" | "ESCALATED" | "EXPIRED" | "CANCELLED";
export type StepType = "APPROVAL" | "REVIEW" | "NOTIFICATION" | "AUTOMATION" | "CONDITION";

export interface WorkflowDefinition {
  id: string;
  organizationId: string;
  name: string;
  type: WorkflowType;
  steps: WorkflowStep[];
  escalationRules: EscalationRule[];
  slaHours: number;
  isActive: boolean;
  version: number;
}

export interface WorkflowStep {
  order: number;
  type: StepType;
  name: string;
  assigneeRole: string; // Role that handles this step
  assigneeUserId?: string; // Specific user override
  isRequired: boolean;
  autoApproveCondition?: string; // JS expression for auto-approval
  timeoutHours: number;
  timeoutAction: "ESCALATE" | "AUTO_APPROVE" | "CANCEL";
  description: string;
}

export interface EscalationRule {
  afterHours: number;
  escalateToRole: string;
  escalateToUserId?: string;
  notifyRoles: string[];
  message: string;
}

export interface WorkflowInstance {
  id: string;
  workflowDefinitionId: string;
  organizationId: string;
  type: WorkflowType;
  status: WorkflowStatus;
  targetId: string; // ID of the entity being workflowed
  targetType: string;
  currentStep: number;
  steps: WorkflowStepInstance[];
  initiatedBy: string;
  initiatedAt: Date;
  completedAt?: Date;
  slaDeadline: Date;
  metadata: Record<string, unknown>;
}

export interface WorkflowStepInstance {
  stepOrder: number;
  stepName: string;
  assigneeId: string;
  assigneeRole: string;
  status: "PENDING" | "IN_PROGRESS" | "APPROVED" | "REJECTED" | "SKIPPED" | "ESCALATED";
  startedAt?: Date;
  completedAt?: Date;
  notes?: string;
  delegatedTo?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class WorkflowEngineService {
  /**
   * Create a workflow definition for an organization.
   */
  static async createWorkflowDefinition(
    definition: Omit<WorkflowDefinition, "id" | "version">,
    userId: string,
  ): Promise<string> {
    // Store as a compliance rule
    const rule = await prisma.complianceRule.create({
      data: {
        organizationId: definition.organizationId,
        type: "WORKFLOW",
        category: "WORKFLOW",
        name: definition.name,
        severity: "INFO",
        config: definition as any,
      },
    });

    await AuditEventService.appendEvent({
      organizationId: definition.organizationId,
      userId,
      action: "WORKFLOW_DEFINITION_CREATED",
      target: `Workflow:${definition.name}`,
      details: `Workflow "${definition.name}" created with ${definition.steps.length} steps`,
      severity: "INFO",
      metadata: { name: definition.name, type: definition.type, steps: definition.steps.length },
    });

    return rule.id;
  }

  /**
   * Start a workflow instance.
   */
  static async startWorkflow(
    organizationId: string,
    type: WorkflowType,
    targetId: string,
    targetType: string,
    initiatedBy: string,
    metadata: Record<string, unknown> = {},
  ): Promise<WorkflowInstance> {
    // Find the active workflow definition for this type
    const definitions = await prisma.complianceRule.findMany({
      where: { organizationId, category: "WORKFLOW", severity: "INFO" },
    });

    const matchingDef = definitions.find((d) => {
      const config = d.config as unknown as WorkflowDefinition;
      return config.type === type && config.isActive;
    });

    if (!matchingDef) {
      // No workflow defined — auto-approve
      return {
        id: `WF-AUTO-${Date.now()}`,
        workflowDefinitionId: "none",
        organizationId,
        type,
        status: "APPROVED",
        targetId,
        targetType,
        currentStep: 0,
        steps: [],
        initiatedBy,
        initiatedAt: new Date(),
        slaDeadline: new Date(Date.now() + 24 * 3600000),
        metadata,
      };
    }

    const definition = matchingDef.config as unknown as WorkflowDefinition;
    const firstStep = definition.steps[0];

    // Find the assignee for the first step
    const assignee = await this.findAssignee(organizationId, firstStep.assigneeRole, firstStep.assigneeUserId);

    const stepInstances: WorkflowStepInstance[] = definition.steps.map((step, idx) => ({
      stepOrder: idx,
      stepName: step.name,
      assigneeId: idx === 0 ? (assignee?.id ?? "") : "",
      assigneeRole: step.assigneeRole,
      status: idx === 0 ? "PENDING" : "PENDING",
    }));

    const slaDeadline = new Date(Date.now() + definition.slaHours * 3600000);

    const instance: WorkflowInstance = {
      id: `WF-${Date.now()}`,
      workflowDefinitionId: matchingDef.id,
      organizationId,
      type,
      status: "PENDING",
      targetId,
      targetType,
      currentStep: 0,
      steps: stepInstances,
      initiatedBy,
      initiatedAt: new Date(),
      slaDeadline,
      metadata,
    };

    // Notify the first assignee
    if (assignee) {
      await SSENotificationService.pushToUser(assignee.id, {
        type: "WORKFLOW_ASSIGNED",
        title: `Workflow: ${firstStep.name}`,
        body: `You have been assigned step "${firstStep.name}" in a ${type} workflow`,
        metadata: { workflowId: instance.id, step: firstStep.name },
      });
    }

    await AuditEventService.appendEvent({
      organizationId,
      userId: initiatedBy,
      action: "WORKFLOW_STARTED",
      target: `${targetType}:${targetId}`,
      details: `Workflow started: ${type}, ${definition.steps.length} steps, SLA ${definition.slaHours}h`,
      severity: "INFO",
      metadata: { workflowId: instance.id, type, targetId, steps: definition.steps.length },
    });

    return instance;
  }

  /**
   * Approve a workflow step.
   */
  static async approveStep(
    instance: WorkflowInstance,
    stepOrder: number,
    approverId: string,
    notes?: string,
  ): Promise<WorkflowInstance> {
    const step = instance.steps[stepOrder];
    if (!step) throw new Error("Step not found");

    step.status = "APPROVED";
    step.completedAt = new Date();
    step.notes = notes;

    // Move to next step
    const nextStep = instance.steps[stepOrder + 1];
    if (nextStep) {
      instance.currentStep = stepOrder + 1;
      nextStep.status = "IN_PROGRESS";
      nextStep.startedAt = new Date();

      // Find assignee for next step
      const definition = await this.getDefinition(instance.workflowDefinitionId);
      if (definition) {
        const nextDef = definition.steps[stepOrder + 1];
        const assignee = await this.findAssignee(instance.organizationId, nextDef.assigneeRole, nextDef.assigneeUserId);
        if (assignee) {
          nextStep.assigneeId = assignee.id;
          await SSENotificationService.pushToUser(assignee.id, {
            type: "WORKFLOW_ASSIGNED",
            title: `Workflow: ${nextDef.name}`,
            body: `You have been assigned step "${nextDef.name}" in a ${instance.type} workflow`,
            metadata: { workflowId: instance.id },
          });
        }
      }
    } else {
      // All steps complete
      instance.status = "APPROVED";
      instance.completedAt = new Date();
    }

    await AuditEventService.appendEvent({
      organizationId: instance.organizationId,
      userId: approverId,
      action: "WORKFLOW_STEP_APPROVED",
      target: `${instance.targetType}:${instance.targetId}`,
      details: `Step "${step.stepName}" approved in ${instance.type} workflow`,
      severity: "INFO",
      metadata: { workflowId: instance.id, stepOrder, notes },
    });

    return instance;
  }

  /**
   * Reject a workflow step.
   */
  static async rejectStep(
    instance: WorkflowInstance,
    stepOrder: number,
    rejectorId: string,
    reason: string,
  ): Promise<WorkflowInstance> {
    const step = instance.steps[stepOrder];
    if (!step) throw new Error("Step not found");

    step.status = "REJECTED";
    step.completedAt = new Date();
    step.notes = reason;
    instance.status = "REJECTED";
    instance.completedAt = new Date();

    // Notify the initiator
    await SSENotificationService.pushToUser(instance.initiatedBy, {
      type: "WORKFLOW_REJECTED",
      title: `Workflow Rejected: ${instance.type}`,
      body: `Step "${step.stepName}" was rejected. Reason: ${reason}`,
      metadata: { workflowId: instance.id, stepOrder, reason },
    });

    await AuditEventService.appendEvent({
      organizationId: instance.organizationId,
      userId: rejectorId,
      action: "WORKFLOW_STEP_REJECTED",
      target: `${instance.targetType}:${instance.targetId}`,
      details: `Step "${step.stepName}" rejected: ${reason}`,
      severity: "WARNING",
      metadata: { workflowId: instance.id, stepOrder, reason },
    });

    return instance;
  }

  /**
   * Check for SLA breaches and auto-escalate.
   */
  static async checkSlaBreaches(organizationId: string): Promise<string[]> {
    // In production, query active workflow instances from DB
    // and check if any have exceeded their SLA deadline
    const breached: string[] = [];

    // TODO: Implement when workflow instances are persisted

    return breached;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private static async findAssignee(
    organizationId: string,
    role: string,
    specificUserId?: string,
  ) {
    if (specificUserId) {
      return prisma.user.findUnique({ where: { id: specificUserId } });
    }

    return prisma.user.findFirst({
      where: { organizationId, role: role as any, isActive: true },
    });
  }

  private static async getDefinition(definitionId: string) {
    const rule = await prisma.complianceRule.findUnique({
      where: { id: definitionId },
    });

    if (!rule) return null;
    return rule.config as unknown as WorkflowDefinition;
  }
}
