import "server-only";

import prisma from "@/lib/db";
import { callClaudeStructured } from "@/lib/services/ai.service";
import { AuditEventService } from "@/lib/services/audit-event.service";
import { BillingService } from "@/lib/services/billing.service";
import { ClientMemoryService } from "@/lib/services/client-memory.service";
import { CommunicationService } from "@/lib/services/communication.service";
import { detectClientOpportunities } from "@/lib/engines/opportunity.engine";
import { OrgOperationalSettings } from "@/lib/org-operational-settings";

interface ExtractedCommitment {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  sourceEvidence: string;
}

interface ExtractedMeetingWorkflow {
  summary: string;
  commitments: ExtractedCommitment[];
}

export class MeetingWorkflowService {
  private static async extractWorkflowData(params: {
    organizationId: string;
    userId: string;
    meeting: {
      id: string;
      title: string;
      type: string;
      scheduledAt: Date;
      notes: string | null;
      client: {
        id: string;
        name: string;
        type: string;
        aum: number | null;
        riskProfile: string | null;
        lastContactAt: Date | null;
      };
    };
    openTasks: Array<{ title: string; priority: string; dueDate: Date | null }>;
    openOpportunities: Array<{ type: string; suggestedAction: string; status: string }>;
  }): Promise<ExtractedMeetingWorkflow> {
    const meetingNotes = params.meeting.notes?.trim();
    if (!meetingNotes) {
      return {
        summary: "Meeting marked completed. No stored notes were available for structured commitment extraction.",
        commitments: [],
      };
    }

    const orgFlags = await OrgOperationalSettings.get(params.organizationId);
    if (!orgFlags.aiFeaturesEnabled) {
      return {
        summary: `Meeting notes are on file (${meetingNotes.length} characters). AI commitment extraction is disabled by firm policy — review notes manually and add tasks as needed.`,
        commitments: [],
      };
    }

    const groundedContext = {
      meeting: {
        id: params.meeting.id,
        title: params.meeting.title,
        type: params.meeting.type,
        scheduledAt: params.meeting.scheduledAt.toISOString(),
        notes: meetingNotes,
      },
      client: {
        id: params.meeting.client.id,
        name: params.meeting.client.name,
        type: params.meeting.client.type,
        aum: params.meeting.client.aum,
        riskProfile: params.meeting.client.riskProfile,
        lastContactAt: params.meeting.client.lastContactAt?.toISOString() ?? null,
      },
      openTasks: params.openTasks.map((task) => ({
        title: task.title,
        priority: task.priority,
        dueDate: task.dueDate?.toISOString() ?? null,
      })),
      openOpportunities: params.openOpportunities,
    };

    const result = await callClaudeStructured<ExtractedMeetingWorkflow>(
      `You are an operations extraction engine for a registered investment advisor.

STRICT RULES:
1. Extract only commitments, follow-ups, or advisor actions that are explicitly supported by the provided stored meeting notes.
2. Do not infer portfolio changes, tax actions, or compliance work unless plainly stated in the notes.
3. If a commitment is ambiguous, omit it rather than guessing.
4. Keep titles short and operational.
5. Return JSON only matching the schema.`,
      JSON.stringify(groundedContext),
      {
        feature: "CLIENT_SUMMARY",
        organizationId: params.organizationId,
        userId: params.userId,
        modelOverride: "claude-sonnet-4-20250514",
        maxTokens: 1800,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            commitments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  priority: { type: "string" },
                  sourceEvidence: { type: "string" },
                },
                required: ["title", "description", "priority", "sourceEvidence"],
              },
            },
          },
          required: ["summary", "commitments"],
        },
      },
    );

    return {
      summary: result.summary.trim(),
      commitments: (result.commitments ?? [])
        .filter((item) => item.title?.trim() && item.description?.trim() && item.sourceEvidence?.trim())
        .slice(0, 10)
        .map((item) => ({
          title: item.title.trim(),
          description: item.description.trim(),
          priority: item.priority === "HIGH" || item.priority === "LOW" ? item.priority : "MEDIUM",
          sourceEvidence: item.sourceEvidence.trim(),
        })),
    };
  }

  static async completeMeeting(params: {
    organizationId: string;
    userId: string;
    meetingId: string;
    notes?: string | null;
  }) {
    const featureAccess = await BillingService.checkFeatureAccess(
      params.organizationId,
      "POST_MEETING_WORKFLOW",
    );

    if (!featureAccess.allowed) {
      throw new Error(featureAccess.reason ?? "Post-meeting workflow is not enabled for this plan.");
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.meetingId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            organizationId: true,
            type: true,
            aum: true,
            riskProfile: true,
            lastContactAt: true,
          },
        },
      },
    });

    if (!meeting) {
      throw new Error("Meeting not found.");
    }

    if (meeting.client.organizationId !== params.organizationId) {
      throw new Error("Meeting does not belong to this organization.");
    }

    if (meeting.status === "COMPLETED") {
      throw new Error("Meeting has already been completed.");
    }

    const advisor = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, name: true, email: true },
    });

    if (!advisor) {
      throw new Error("Advisor not found.");
    }

    const mergedNotes = params.notes?.trim() ? params.notes.trim() : meeting.notes;

    const [openTasks, openOpportunities] = await Promise.all([
      prisma.task.findMany({
        where: { clientId: meeting.clientId, isCompleted: false },
        select: { title: true, priority: true, dueDate: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.opportunity.findMany({
        where: { clientId: meeting.clientId, status: { not: "REJECTED" } },
        select: { type: true, suggestedAction: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const extracted = await this.extractWorkflowData({
      organizationId: params.organizationId,
      userId: params.userId,
      meeting: {
        id: meeting.id,
        title: meeting.title,
        type: meeting.type,
        scheduledAt: meeting.scheduledAt,
        notes: mergedNotes,
        client: {
          id: meeting.client.id,
          name: meeting.client.name,
          type: meeting.client.type,
          aum: meeting.client.aum,
          riskProfile: meeting.client.riskProfile,
          lastContactAt: meeting.client.lastContactAt,
        },
      },
      openTasks,
      openOpportunities,
    });

    const completedAt = new Date();

    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        status: "COMPLETED",
        notes: mergedNotes ?? undefined,
      },
    });

    await prisma.client.update({
      where: { id: meeting.client.id },
      data: {
        lastContactAt: completedAt,
      },
    });

    let tasksCreated = 0;
    for (const commitment of extracted.commitments) {
      const existingTask = await prisma.task.findFirst({
        where: {
          clientId: meeting.client.id,
          title: commitment.title,
          isCompleted: false,
        },
        select: { id: true },
      });

      if (existingTask) continue;

      await prisma.task.create({
        data: {
          userId: params.userId,
          clientId: meeting.client.id,
          title: commitment.title,
          description: `${commitment.description}\n\nSource evidence: ${commitment.sourceEvidence}`,
          priority: commitment.priority,
          source: "AI_GENERATED",
        },
      });
      tasksCreated += 1;
    }

    const communication = await CommunicationService.generatePostMeetingFollowUpDraft({
      organizationId: params.organizationId,
      userId: params.userId,
      clientId: meeting.client.id,
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      meetingDate: meeting.scheduledAt.toISOString(),
      meetingNotes: mergedNotes,
      commitments: extracted.commitments,
    });

    const memorySnapshot = await ClientMemoryService.refreshSnapshot(meeting.client.id);
    const detected = await detectClientOpportunities(meeting.client.id);

    let opportunitiesDetected = 0;
    for (const signal of detected) {
      const existing = await prisma.opportunity.findFirst({
        where: {
          clientId: meeting.client.id,
          type: signal.type,
          suggestedAction: signal.suggestedAction,
          status: { not: "REJECTED" },
        },
        select: { id: true },
      });

      if (existing) continue;

      await prisma.opportunity.create({
        data: {
          clientId: meeting.client.id,
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
      opportunitiesDetected += 1;
    }

    await AuditEventService.appendEvent({
      organizationId: params.organizationId,
      userId: params.userId,
      action: "POST_MEETING_WORKFLOW_COMPLETED",
      target: "Meeting",
      targetId: meeting.id,
      details: `Post-meeting workflow completed for ${meeting.title}.`,
      beforeState: {
        status: meeting.status,
        notes: meeting.notes,
        lastContactAt: meeting.client.lastContactAt?.toISOString() ?? null,
      },
      afterState: {
        status: "COMPLETED",
        notes: mergedNotes ?? null,
        lastContactAt: completedAt.toISOString(),
      },
      aiInvolved: true,
      severity: "INFO",
      metadata: {
        clientId: meeting.client.id,
        communicationId: communication.id,
        tasksCreated,
        opportunitiesDetected,
        memorySnapshotId: memorySnapshot.snapshot.id,
        commitmentCount: extracted.commitments.length,
        extractedSummary: extracted.summary,
      },
    });

    return {
      meetingId: meeting.id,
      clientId: meeting.client.id,
      communicationId: communication.id,
      workflow: {
        tasksCreated,
        opportunitiesDetected,
        commitmentsExtracted: extracted.commitments.length,
        extractedSummary: extracted.summary,
        memorySnapshotId: memorySnapshot.snapshot.id,
      },
    };
  }
}
