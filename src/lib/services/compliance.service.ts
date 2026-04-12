import prisma from '../db'
import { EscalationService } from './escalation.service'
import { parseFinding, type ExplainableFinding } from '../findings'
import { ComplianceNLPService } from './compliance-nlp.service'

type ReviewSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

interface ReviewQueueItem {
  id: string
  source: 'COMMUNICATION' | 'TAX' | 'OPPORTUNITY' | 'INVESTMENT' | 'FLAG' | 'RESEARCH'
  type: string | null
  severity: ReviewSeverity
  title: string
  description: string
  clientName: string
  createdAt: Date
  aiInvolved: boolean
  status: string
  metadata: {
    body?: string
    impact?: string | null
    value?: number | null
    reasoning?: string | null
    finding?: ExplainableFinding | null
    risks?: string | null
    catalysts?: string | null
  }
}

export class ComplianceService {
  static async getAuditLogs(limit = 100) {
    return prisma.auditLog.findMany({
      include: { user: true },
      orderBy: { timestamp: 'desc' },
      take: limit,
    })
  }

  static async getFlags() {
    return prisma.complianceFlag.findMany({
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    })
  }

  static async getStats() {
    const [openFlags, criticalFlags, totalLogs, aiLogs] = await Promise.all([
      prisma.complianceFlag.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      prisma.complianceFlag.count({ where: { severity: 'CRITICAL', status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { aiInvolved: true } }),
    ])
    return { openFlags, criticalFlags, totalLogs, aiLogs }
  }

  /**
   * Scans a text draft for regulatory compliance risks.
   * Now uses NLP-powered scanning with deterministic + AI-assisted detection.
   */
  static async scanDraft(text: string, orgId: string, targetId: string, targetType: string, userId?: string) {
    return ComplianceNLPService.fullScan(text, orgId, targetId, targetType, userId)
  }

  /**
   * Performs institutional-grade compliance auditing across client documents and engagement.
   */
  static async runGlobalComplianceCheck(orgId: string) {
    const clients = await prisma.client.findMany({
        where: { organizationId: orgId },
        include: { documents: true, communications: true }
    })

    const now = new Date()
    let flagsCreated = 0

    for (const client of clients) {
        // 1. Stale Document Check (e.g., Estate plans older than 5 years)
        const estatePlane = client.documents.find((d) => d.documentType === 'ESTAKE_PLAN' || d.documentType === 'TRUST_AGREEMENT')
        if (estatePlane) {
            const ageInYears = (now.getTime() - estatePlane.uploadedAt.getTime()) / (1000 * 60 * 60 * 24 * 365)
            if (ageInYears > 5) {
                await prisma.complianceFlag.create({
                    data: {
                        organizationId: orgId,
                        type: 'STALE_RECOMMENDATION',
                        severity: 'MEDIUM',
                        description: `Estate planning documents for ${client.name} are >5 years old (Uploaded: ${estatePlane.uploadedAt.toLocaleDateString()}). Regulatory best practice suggests quinquennial review.`,
                        target: 'Document',
                        targetId: estatePlane.id,
                        status: 'OPEN',
                        aiInvolved: true
                    }
                })
                flagsCreated++
            }
        }

        // 2. Engagement Latency (Regulatory 'Books and Records' check)
        const lastComm = client.communications
          .filter((c) => c.direction === 'OUTBOUND')
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
        if (lastComm) {
            const daysSinceContact = (now.getTime() - lastComm.timestamp.getTime()) / (1000 * 60 * 60 * 24)
            if (daysSinceContact > 90) {
                 await prisma.complianceFlag.create({
                    data: {
                        organizationId: orgId,
                        type: 'UNAPPROVED_COMMUNICATION', // Misusing type for latency in this schema if needed, but 'STALE' fits better
                        severity: 'HIGH',
                        description: `Communication gap detected. ${client.name} (HNW) has not had an outbound touchpoint in ${Math.round(daysSinceContact)} days. Potential breach of fiduciary monitoring standards.`,
                        target: 'Client',
                        targetId: client.id,
                        status: 'OPEN',
                        aiInvolved: true
                    }
                })
                flagsCreated++
            }
        }
    }

    // Institutional Hardening: Auto-escalate stagnant or critical risks into tasks
    const { escalationsCount } = await EscalationService.processEscalations(orgId)

    return { flagsCreated, escalationsCount }
  }

  /**
   * Resolves a compliance flag.
   */
  static async resolveFlag(flagId: string, userId: string) {
    return prisma.complianceFlag.update({
      where: { id: flagId },
      data: {
        status: 'RESOLVED',
        reviewedBy: userId,
        resolvedAt: new Date(),
      }
    })
  }

  /**
   * Aggregates all pending reviews across the platform into a unified inbox.
   * Standard for institutional compliance oversight.
   */
  static async getUnifiedReviewQueue() {
    const [comms, tax, opps, investInsights, flags, memos] = await Promise.all([
      prisma.communication.findMany({
        where: { status: 'PENDING_APPROVAL' },
        include: { client: true },
        orderBy: { timestamp: 'desc' }
      }),
      prisma.taxInsight.findMany({
        where: { status: 'UNDER_REVIEW' },
        include: { client: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.opportunity.findMany({
        where: { status: { in: ['DRAFT', 'PENDING_REVIEW'] } },
        include: { client: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.investmentInsight.findMany({
        where: { status: 'UNDER_REVIEW' },
        include: { client: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.complianceFlag.findMany({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.researchMemo.findMany({
        where: { status: 'PENDING_REVIEW' },
        include: { client: true },
        orderBy: { createdAt: 'desc' }
      })
    ])

    const unified: ReviewQueueItem[] = [
      ...comms.map((c): ReviewQueueItem => ({
        id: c.id,
        source: 'COMMUNICATION',
        type: c.type,
        severity: 'MEDIUM',
        title: `Outreach Signature: ${c.subject || 'Strategic Email'}`,
        description: `Draft outreach for ${c.client.name} requiring compliance sign-off.`,
        clientName: c.client.name,
        createdAt: c.timestamp,
        aiInvolved: true,
        status: c.status,
        metadata: { body: c.body ?? undefined }
      })),
      ...tax.map((t): ReviewQueueItem => {
        const finding = parseFinding(t.explanation)
        return {
        id: t.id,
        source: 'TAX',
        type: t.category,
        severity: t.riskLevel as ReviewSeverity,
        title: `Tax Strategy: ${t.title}`,
        description: finding?.whyItMatters ?? t.rationale,
        clientName: t.client.name,
        createdAt: t.createdAt,
        aiInvolved: true,
        status: t.status,
        metadata: {
          impact: t.estimatedImpact,
          reasoning: finding?.insight ?? t.explanation,
          finding,
        }
      }}),
      ...opps.map((o): ReviewQueueItem => {
        const finding = parseFinding(o.reasoning)
        return {
        id: o.id,
        source: 'OPPORTUNITY',
        type: o.type,
        severity: o.riskLevel as ReviewSeverity,
        title: `Strategic Opp: ${o.type}`,
        description: finding?.whyItMatters ?? o.description,
        clientName: o.client.name,
        createdAt: o.createdAt,
        aiInvolved: true,
        status: o.status,
        metadata: {
          value: o.valueEst,
          reasoning: finding?.insight ?? o.reasoning,
          finding,
        }
      }}),
      ...investInsights.map((insight): ReviewQueueItem => {
        const finding = parseFinding(insight.dataSources)
        return {
        id: insight.id,
        source: 'INVESTMENT',
        type: insight.assetTicker ?? 'PORTFOLIO',
        severity: insight.confidence >= 80 ? 'MEDIUM' : 'LOW',
        title: `Investment Insight: ${insight.title}`,
        description: finding?.whyItMatters ?? insight.thesis,
        clientName: insight.client.name,
        createdAt: insight.createdAt,
        aiInvolved: true,
        status: insight.status,
        metadata: {
          reasoning: finding?.insight ?? insight.dataSources,
          finding,
          risks: insight.risks,
          catalysts: insight.catalysts,
        }
      }}),
      ...flags.map((f): ReviewQueueItem => ({
        id: f.id,
        source: 'FLAG',
        type: f.type,
        severity: f.severity as ReviewSeverity,
        title: `Compliance Intervention: ${f.type.replace(/_/g, ' ')}`,
        description: f.description,
        clientName: f.target === 'Client' ? 'Direct Entity' : 'Linked Asset',
        createdAt: f.createdAt,
        aiInvolved: f.aiInvolved,
        status: f.status,
        metadata: {}
      })),
      ...memos.map((m): ReviewQueueItem => ({
        id: m.id,
        source: 'RESEARCH',
        type: 'INVESTMENT_MEMO',
        severity: 'MEDIUM',
        title: `Research Memo: ${m.title}`,
        description: m.thesis,
        clientName: m.client?.name || 'General Market',
        createdAt: m.createdAt,
        aiInvolved: true,
        status: m.status,
        metadata: { risks: m.risks, catalysts: m.catalysts }
      }))
    ]

    return unified.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }
}
