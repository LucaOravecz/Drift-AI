import prisma from "@/lib/db";

type Tone = "emerald" | "cyan" | "amber" | "rose";

function subtractDays(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(value / 1_000).toLocaleString()}k`;
}

function scoreTone(score: number): Tone {
  if (score >= 80) return "emerald";
  if (score >= 65) return "cyan";
  if (score >= 45) return "amber";
  return "rose";
}

export class RenewalReadinessService {
  static async getCenter(orgId: string) {
    const now = new Date();
    const last30Days = subtractDays(30);
    const last14Days = subtractDays(14);
    const next14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const [users, recentSessions, tasks, aiUsage, clients, opportunities, meetings, flags, integrations] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { id: true, name: true, email: true, role: true },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      }),
      prisma.userSession.findMany({
        where: {
          user: { organizationId: orgId },
          lastSeenAt: { gte: last14Days },
        },
        distinct: ["userId"],
        select: { userId: true, lastSeenAt: true },
        orderBy: { lastSeenAt: "desc" },
      }),
      prisma.task.findMany({
        where: {
          user: { organizationId: orgId },
          OR: [{ createdAt: { gte: last30Days } }, { completedAt: { gte: last30Days } }],
        },
        select: { userId: true, isCompleted: true, completedAt: true, priority: true },
      }),
      prisma.aiUsageRecord.findMany({
        where: { organizationId: orgId, createdAt: { gte: last30Days } },
        select: { userId: true, feature: true, costUsd: true },
      }),
      prisma.client.findMany({
        where: { organizationId: orgId, deletedAt: null },
        select: { id: true, type: true, aum: true, churnScore: true, lastContactAt: true },
      }),
      prisma.opportunity.findMany({
        where: { client: { organizationId: orgId }, deletedAt: null },
        select: { clientId: true, valueEst: true, status: true, createdAt: true, client: { select: { type: true } } },
      }),
      prisma.meeting.findMany({
        where: { client: { organizationId: orgId }, scheduledAt: { gte: now, lte: next14Days } },
        select: { id: true, briefGenerated: true, scheduledAt: true, client: { select: { type: true } } },
      }),
      prisma.complianceFlag.findMany({
        where: { organizationId: orgId },
        select: { status: true, resolvedAt: true, severity: true },
      }),
      prisma.integrationConfig.findMany({
        where: { organizationId: orgId },
        select: { status: true, category: true, lastSyncAt: true, errorCount: true },
      }),
    ]);

    const recentSessionMap = new Map(recentSessions.map((session) => [session.userId, session.lastSeenAt]));
    const tasksByUser = new Map<string, { completed: number; open: number; urgent: number }>();
    tasks.forEach((task) => {
      if (!task.userId) return;
      const current = tasksByUser.get(task.userId) ?? { completed: 0, open: 0, urgent: 0 };
      if (task.isCompleted) current.completed += 1;
      else current.open += 1;
      if (task.priority === "URGENT") current.urgent += 1;
      tasksByUser.set(task.userId, current);
    });

    const aiByUser = new Map<string, { assists: number; costUsd: number }>();
    aiUsage.forEach((record) => {
      if (!record.userId) return;
      const current = aiByUser.get(record.userId) ?? { assists: 0, costUsd: 0 };
      current.assists += 1;
      current.costUsd += record.costUsd ?? 0;
      aiByUser.set(record.userId, current);
    });

    const advisors = users.map((user) => {
      const tasksForUser = tasksByUser.get(user.id) ?? { completed: 0, open: 0, urgent: 0 };
      const aiForUser = aiByUser.get(user.id) ?? { assists: 0, costUsd: 0 };
      const lastSeenAt = recentSessionMap.get(user.id) ?? null;
      const readinessScore = Math.max(
        20,
        Math.min(
          98,
          35 +
            (lastSeenAt ? 20 : 0) +
            Math.min(tasksForUser.completed * 4, 24) +
            Math.min(aiForUser.assists * 2, 12) -
            Math.min(tasksForUser.urgent * 4, 16),
        ),
      );

      return {
        id: user.id,
        name: user.name ?? user.email,
        role: user.role.replace(/_/g, " "),
        readinessScore,
        readinessTone: scoreTone(readinessScore),
        lastSeen: lastSeenAt ? lastSeenAt.toLocaleString("en-US", { month: "short", day: "numeric" }) : "No recent sign-in",
        completedTasks: tasksForUser.completed,
        openTasks: tasksForUser.open,
        aiAssists: aiForUser.assists,
      };
    }).sort((left, right) => right.readinessScore - left.readinessScore);

    const clientsWithRecentTouch = clients.filter((client) => client.lastContactAt && client.lastContactAt >= last30Days).length;
    const upcomingMeetings = meetings.length;
    const briefReadyMeetings = meetings.filter((meeting) => meeting.briefGenerated).length;
    const openFlags = flags.filter((flag) => flag.status === "OPEN" || flag.status === "UNDER_REVIEW").length;
    const resolvedLast30 = flags.filter((flag) => flag.status === "RESOLVED" && flag.resolvedAt && flag.resolvedAt >= last30Days).length;
    const activeIntegrations = integrations.filter((integration) => integration.status === "ACTIVE").length;

    const overallScore = Math.round(
      (
        (clients.length > 0 ? clientsWithRecentTouch / clients.length : 0) * 35 +
        (upcomingMeetings > 0 ? briefReadyMeetings / upcomingMeetings : 1) * 20 +
        (flags.length > 0 ? resolvedLast30 / Math.max(openFlags + resolvedLast30, 1) : 1) * 20 +
        (integrations.length > 0 ? activeIntegrations / integrations.length : 1) * 15 +
        (advisors.length > 0 ? advisors.filter((advisor) => advisor.readinessScore >= 70).length / advisors.length : 1) * 10
      ) * 100,
    );

    const teamByRole = users.reduce<Record<string, number>>((accumulator, user) => {
      accumulator[user.role] = (accumulator[user.role] ?? 0) + 1;
      return accumulator;
    }, {});

    const roleCards = Object.entries(teamByRole)
      .map(([role, count]) => ({
        role: role.replace(/_/g, " "),
        count,
        activeInLast14Days: users.filter((user) => user.role === role && recentSessionMap.has(user.id)).length,
      }))
      .sort((left, right) => right.count - left.count);

    const segmentBase = new Map<string, {
      label: string;
      count: number;
      aum: number;
      recentTouch: number;
      churnRisk: number;
      pipeline: number;
      briefReady: number;
      meetings: number;
    }>();

    clients.forEach((client) => {
      const key = client.type || "UNKNOWN";
      const current = segmentBase.get(key) ?? {
        label: key.replace(/_/g, " "),
        count: 0,
        aum: 0,
        recentTouch: 0,
        churnRisk: 0,
        pipeline: 0,
        briefReady: 0,
        meetings: 0,
      };
      current.count += 1;
      current.aum += client.aum ?? 0;
      if (client.lastContactAt && client.lastContactAt >= last30Days) current.recentTouch += 1;
      if (client.churnScore > 75) current.churnRisk += 1;
      segmentBase.set(key, current);
    });

    opportunities.forEach((opportunity) => {
      const key = opportunity.client.type || "UNKNOWN";
      const current = segmentBase.get(key);
      if (!current) return;
      current.pipeline += opportunity.valueEst ?? 0;
    });

    meetings.forEach((meeting) => {
      const key = meeting.client.type || "UNKNOWN";
      const current = segmentBase.get(key);
      if (!current) return;
      current.meetings += 1;
      if (meeting.briefGenerated) current.briefReady += 1;
    });

    const clientSegments = Array.from(segmentBase.values())
      .map((segment) => {
        const coverage = segment.count > 0 ? Math.round((segment.recentTouch / segment.count) * 100) : 0;
        const briefCoverage = segment.meetings > 0 ? Math.round((segment.briefReady / segment.meetings) * 100) : 100;
        const readinessScore = Math.round(coverage * 0.5 + briefCoverage * 0.3 + Math.max(0, 100 - segment.churnRisk * 15) * 0.2);
        return {
          ...segment,
          coverage,
          briefCoverage,
          readinessScore,
          tone: scoreTone(readinessScore),
          pipelineLabel: formatCurrency(segment.pipeline),
          aumLabel: formatCurrency(segment.aum),
        };
      })
      .sort((left, right) => right.pipeline - left.pipeline);

    const summaryCards = [
      {
        label: "Renewal Readiness Score",
        value: `${overallScore}`,
        detail: "Blends client coverage, meeting-prep readiness, compliance closure, integration health, and active operator coverage.",
        tone: scoreTone(overallScore),
      },
      {
        label: "Ready-to-defend pipeline",
        value: formatCurrency(opportunities.reduce((sum, opportunity) => sum + (opportunity.valueEst ?? 0), 0)),
        detail: "Pipeline is visible by segment and already attached to client context rather than hidden in notes.",
        tone: "cyan" as Tone,
      },
      {
        label: "Team coverage",
        value: `${advisors.filter((advisor) => advisor.readinessScore >= 70).length}/${advisors.length}`,
        detail: "Users with strong recent operating signal across sign-ins, tasks completed, and AI-assisted production.",
        tone: "emerald" as Tone,
      },
      {
        label: "Open supervision load",
        value: `${openFlags}`,
        detail: `${resolvedLast30} items resolved in the last 30 days. Lower backlog strengthens renewal conversations.`,
        tone: openFlags <= 3 ? ("emerald" as Tone) : openFlags <= 6 ? ("amber" as Tone) : ("rose" as Tone),
      },
    ];

    const renewalTalkingPoints = [
      `${clientsWithRecentTouch} of ${clients.length} clients have fresh recent-touch coverage in the last 30 days.`,
      `${briefReadyMeetings} of ${upcomingMeetings} upcoming meetings already have a generated brief attached.`,
      `${activeIntegrations} of ${integrations.length || 0} integrations are currently marked active across the operating stack.`,
      `${advisors.filter((advisor) => advisor.aiAssists > 0).length} active users used AI-supported workflows in the last 30 days.`,
    ];

    return {
      headline: "Renewal Readiness Center",
      subheadline:
        "This is the partner-level view: whether the firm is using the platform deeply enough across people, process, and client segments to justify premium spend at renewal time.",
      overallScore,
      summaryCards,
      advisors,
      roleCards,
      clientSegments,
      renewalTalkingPoints,
    };
  }
}
