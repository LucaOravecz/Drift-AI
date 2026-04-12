import prisma from '../db'

/**
 * Intelligence Service — Client Scoring
 *
 * Churn and sentiment scoring methodology (fully transparent):
 *
 * CHURN SCORE (0-100):
 *   Base signal: Days since last contact
 *     > 90 days: +40 points (HIGH risk)
 *     > 60 days: +20 points (MEDIUM risk)
 *     > 30 days: +10 points (WATCH)
 *     No contact recorded: +50 points
 *   High/urgent tasks: +15 per open HIGH or URGENT priority task
 *   Negative sentiment keywords in communications: +20 per match
 *     Keywords checked: 'disappointed', 'frustrated', 'issue'
 *     NOTE: This is a keyword heuristic — not semantic analysis
 *
 * SENTIMENT SCORE (0-100):
 *   Base: current stored sentimentScore (or 75 if not set)
 *   Adjusted: -10 per negative sentiment keyword found in recent 10 communications
 *   Floor: 20
 *
 * LIMITATIONS:
 * - Churn score does NOT reflect the quality of the relationship
 * - Keyword matching is a proxy signal only — not NLP
 * - Scores should be reviewed by advisor, not acted on blindly
 * - No ML model is used — these are rule-based heuristics
 */

interface ClientWithRelations {
  id: string
  organizationId: string
  name: string
  lastContactAt: Date | null
  communications: { body: string | null }[]
  tasks: { priority: string }[]
  intelligence: { sentimentScore: number | null } | null
}

export interface IntelligenceSyncResult {
  churnScore: number
  sentimentScore: number
  scoringBreakdown: {
    contactDays: number | null
    contactSignal: number
    highPriorityTasks: number
    taskSignal: number
    negativeSentimentMatches: number
    sentimentSignal: number
    totalChurnScore: number
    sentimentAdjustment: number
  }
}

export interface EngineOverview {
  dataInputs: { label: string; count: string; note: string }[]
  recentOutputs: {
    id: string
    type: string
    title: string
    client: string
    status: string
    detail: string
  }[]
}

export class IntelligenceService {
  static async syncClientIntelligence(clientId: string): Promise<IntelligenceSyncResult | null> {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        communications: { orderBy: { timestamp: 'desc' }, take: 10 },
        tasks: { where: { isCompleted: false } },
        intelligence: true,
      },
    }) as ClientWithRelations | null

    if (!client) return null

    // ── Churn Score Calculation (fully documented) ──────────────────────────

    let contactSignal = 0
    let contactDays: number | null = null

    if (client.lastContactAt) {
      contactDays = Math.floor(
        (Date.now() - client.lastContactAt.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (contactDays > 90) contactSignal = 40
      else if (contactDays > 60) contactSignal = 20
      else if (contactDays > 30) contactSignal = 10
    } else {
      contactSignal = 50 // No contact on record
    }

    const highPriorityTasks = client.tasks.filter(
      (t) => t.priority === 'HIGH' || t.priority === 'URGENT'
    )
    const taskSignal = highPriorityTasks.length * 15

    // Keyword heuristic — limited NLP proxy
    const NEGATIVE_KEYWORDS = ['disappointed', 'frustrated', 'issue']
    const negativeSentimentMatches = client.communications.filter((c) =>
      NEGATIVE_KEYWORDS.some((kw) => c.body?.toLowerCase().includes(kw))
    ).length
    const sentimentSignal = negativeSentimentMatches * 20

    const totalChurnScore = Math.min(contactSignal + taskSignal + sentimentSignal, 100)

    // ── Sentiment Score Calculation ─────────────────────────────────────────
    const baseSentiment = client.intelligence?.sentimentScore ?? 75
    const sentimentAdjustment = negativeSentimentMatches * 10
    const sentimentScore = Math.max(baseSentiment - sentimentAdjustment, 20)

    const breakdown: IntelligenceSyncResult['scoringBreakdown'] = {
      contactDays,
      contactSignal,
      highPriorityTasks: highPriorityTasks.length,
      taskSignal,
      negativeSentimentMatches,
      sentimentSignal,
      totalChurnScore,
      sentimentAdjustment,
    }

    // Run updates sequentially (avoids $transaction overload ambiguity in Prisma)
    await prisma.client.update({
      where: { id: clientId },
      data: { churnScore: totalChurnScore },
    })
    await prisma.intelligenceProfile.upsert({
      where: { clientId },
      create: {
        clientId,
        sentimentScore,
        relationStrength: 100 - totalChurnScore,
        lastUpdated: new Date(),
      },
      update: {
        sentimentScore,
        relationStrength: 100 - totalChurnScore,
        lastUpdated: new Date(),
      },
    })

    // Only log at CRITICAL threshold — separate from transaction so it doesn't block
    if (totalChurnScore > 75) {
      await prisma.auditLog.create({
        data: {
          organizationId: client.organizationId,
          action: 'HIGH_CHURN_DETECTED',
          target: client.name,
          details: `Churn score: ${totalChurnScore}/100. Breakdown: contact signal=${contactSignal} (${contactDays ?? 'no contact'} days), task signal=${taskSignal} (${highPriorityTasks.length} open high-priority tasks), sentiment signal=${sentimentSignal} (${negativeSentimentMatches} negative keyword matches in recent 10 comms).`,
          aiInvolved: false,
          severity: 'CRITICAL',
        },
      })
    }

    return { churnScore: totalChurnScore, sentimentScore, scoringBreakdown: breakdown }
  }

  static async runGlobalIntelligenceSync(orgId: string) {
    const clients = await prisma.client.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    })

    const results = await Promise.all(
      clients.map((c) => this.syncClientIntelligence(c.id))
    )

    return { syncedCount: results.filter(Boolean).length }
  }

  /**
   * Returns the scoring breakdown for a specific client.
   * Used to show advisors exactly how a score was computed.
   */
  static async getScoreExplanation(clientId: string): Promise<IntelligenceSyncResult | null> {
    return this.syncClientIntelligence(clientId)
  }

  static async getEngineOverview(orgId: string): Promise<EngineOverview> {
    const [
      clientCount,
      documentCount,
      communicationCount,
      meetingCount,
      openOpportunityCount,
      taxInsightCount,
      auditCount,
      memorySnapshotCount,
      opportunities,
      briefs,
      drafts,
      snapshots,
    ] = await Promise.all([
      prisma.client.count({ where: { organizationId: orgId } }),
      prisma.document.count({ where: { client: { organizationId: orgId } } }),
      prisma.communication.count({ where: { client: { organizationId: orgId } } }),
      prisma.meeting.count({ where: { client: { organizationId: orgId } } }),
      prisma.opportunity.count({ where: { client: { organizationId: orgId }, status: { in: ['DRAFT', 'PENDING_REVIEW'] } } }),
      prisma.taxInsight.count({ where: { client: { organizationId: orgId }, status: 'UNDER_REVIEW' } }),
      prisma.auditLog.count({ where: { organizationId: orgId } }),
      prisma.clientMemorySnapshot.count({ where: { client: { organizationId: orgId } } }),
      prisma.opportunity.findMany({
        where: { client: { organizationId: orgId }, status: { in: ['DRAFT', 'PENDING_REVIEW'] } },
        include: { client: true },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      prisma.meeting.findMany({
        where: { client: { organizationId: orgId }, briefGenerated: true },
        include: { client: true },
        orderBy: { scheduledAt: 'desc' },
        take: 3,
      }),
      prisma.communication.findMany({
        where: { client: { organizationId: orgId }, status: 'PENDING_APPROVAL' },
        include: { client: true },
        orderBy: { timestamp: 'desc' },
        take: 3,
      }),
      prisma.clientMemorySnapshot.findMany({
        where: { client: { organizationId: orgId } },
        include: { client: true },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ])

    const dataInputs = [
      { label: 'Client Records', count: `${clientCount}`, note: 'Stored client rows' },
      { label: 'Documents', count: `${documentCount}`, note: 'Uploaded files in DB' },
      { label: 'Communications', count: `${communicationCount}`, note: 'Stored comm history' },
      { label: 'Meetings', count: `${meetingCount}`, note: 'Meeting records' },
      { label: 'Open Opportunities', count: `${openOpportunityCount}`, note: 'DRAFT or PENDING_REVIEW' },
      { label: 'Tax Items', count: `${taxInsightCount}`, note: 'UNDER_REVIEW' },
      { label: 'Audit Events', count: `${auditCount}`, note: 'Stored audit log rows' },
      { label: 'Memory Snapshots', count: `${memorySnapshotCount}`, note: 'Persisted deterministic outputs' },
    ]

    const recentOutputs = [
      ...snapshots.map((snapshot) => ({
        id: snapshot.id,
        type: 'CLIENT_MEMORY',
        title: 'Client memory snapshot',
        client: snapshot.client.name,
        status: snapshot.dataQuality,
        detail: snapshot.summary,
      })),
      ...opportunities.map((opportunity) => ({
        id: opportunity.id,
        type: 'OPPORTUNITY',
        title: opportunity.type.replace(/_/g, ' '),
        client: opportunity.client.name,
        status: opportunity.status,
        detail: opportunity.suggestedAction,
      })),
      ...briefs.map((meeting) => ({
        id: meeting.id,
        type: 'MEETING_BRIEF',
        title: meeting.title,
        client: meeting.client.name,
        status: meeting.status,
        detail: meeting.briefGenerated ? 'Brief saved to meeting record' : 'No brief saved',
      })),
      ...drafts.map((draft) => ({
        id: draft.id,
        type: 'OUTREACH_DRAFT',
        title: draft.subject ?? draft.type,
        client: draft.client.name,
        status: draft.status,
        detail: draft.body?.slice(0, 120) ?? 'Draft body not available',
      })),
    ].slice(0, 10)

    return { dataInputs, recentOutputs }
  }
}
