import prisma from '../db'

/**
 * Dashboard Service — Read-Only Aggregation
 *
 * RULES:
 * 1. This service is READ-ONLY. It does NOT trigger intelligence syncs, tax scans,
 *    or compliance checks on load. Side effects on read operations cause unpredictable
 *    data mutations and poor UX. Those scans are triggered explicitly by advisor actions.
 * 2. No hardcoded metric values. All metrics are computed from DB at query time.
 * 3. Chart data shows actual current-state snapshot, labeled accordingly.
 * 4. Any value that cannot be computed is labeled explicitly as "No data available".
 */
export class DashboardService {
  static async getExecutiveSummary() {
    const [
      clients,
      openOppsAgg,
      highChurnCount,
      onboardingCount,
      taxReviewCount,
      meetingsThisWeek,
      tasksDue,
      flagsOpen,
    ] = await Promise.all([
      prisma.client.findMany({ select: { aum: true, organizationId: true } }),
      prisma.opportunity.aggregate({ _sum: { valueEst: true }, where: { status: 'DRAFT' } }),
      prisma.client.count({ where: { churnScore: { gt: 75 } } }),
      prisma.onboardingWorkflow.count({ where: { stage: { not: 'COMPLETE' } } }),
      prisma.taxInsight.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.meeting.count({
        where: {
          scheduledAt: {
            gte: new Date(Date.now() - 86400000),
            lte: new Date(Date.now() + 7 * 86400000),
          },
          status: 'SCHEDULED',
        },
      }),
      prisma.task.count({
        where: { isCompleted: false, dueDate: { lte: new Date(Date.now() + 3 * 86400000) } },
      }),
      prisma.complianceFlag.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    ])

    const totalAum = clients.reduce((sum, c) => sum + (c.aum ?? 0), 0)
    const formattedAum =
      totalAum >= 1_000_000
        ? `$${(totalAum / 1_000_000).toFixed(1)}M`
        : `$${(totalAum / 1_000).toFixed(0)}k`

    const opsSum = openOppsAgg._sum.valueEst ?? 0
    const formattedRevenue =
      opsSum >= 1_000_000
        ? `$${(opsSum / 1_000_000).toFixed(1)}M`
        : `$${opsSum.toLocaleString()}`

    // AUM change: We do not have historical AUM snapshots, so we cannot compute a real delta.
    // We show the current total with an honest label rather than a fabricated change figure.
    const aumChange = 'No 30d delta — historical snapshots not available'

    return {
      aum: formattedAum,
      aumChange,
      activeClients: clients.length,
      prospects: onboardingCount,
      revenueOpportunities: formattedRevenue,
      churnRisk: highChurnCount,
      taxReviewPending: taxReviewCount,
      meetingsThisWeek,
      tasksDue,
      complianceFlags: flagsOpen,
    }
  }

  static async getPriorityAlerts() {
    const alerts: {
      id: string
      title: string
      description: string
      type: string
      severity: string
      client: string
      timestamp: Date
    }[] = []

    // Churn risk alerts — derived from churnScore field
    const highChurn = await prisma.client.findMany({
      where: { churnScore: { gt: 75 } },
      include: { intelligence: true },
      take: 3,
    })
    highChurn.forEach((c) => {
      const daysSince = c.lastContactAt
        ? Math.floor((Date.now() - c.lastContactAt.getTime()) / 86_400_000)
        : null
      alerts.push({
        id: `churn-${c.id}`,
        title: 'High Churn Risk',
        description: daysSince !== null
          ? `Churn score: ${c.churnScore}/100. Last contact: ${daysSince} days ago.`
          : `Churn score: ${c.churnScore}/100. No contact on record.`,
        type: 'risk',
        severity: 'critical',
        client: c.name,
        timestamp: new Date(),
      })
    })

    // High-confidence opportunities — from stored records
    const topOps = await prisma.opportunity.findMany({
      where: { confidence: { gt: 85 }, status: 'DRAFT' },
      include: { client: true },
      take: 3,
      orderBy: { confidence: 'desc' },
    })
    topOps.forEach((op) => {
      alerts.push({
        id: `opp-${op.id}`,
        title: `Opportunity: ${op.type.replace(/_/g, ' ')}`,
        description: op.description,
        type: 'opportunity',
        severity: 'high',
        client: op.client.name,
        timestamp: new Date(op.createdAt),
      })
    })

    // Blocked onboarding — from stored step records
    const blockedOb = await prisma.onboardingWorkflow.findMany({
      where: { steps: { some: { status: 'BLOCKED' } } },
      include: { client: true, steps: { where: { status: 'BLOCKED' } } },
      take: 2,
    })
    blockedOb.forEach((ob) => {
      alerts.push({
        id: `ob-${ob.id}`,
        title: 'Onboarding Stalled',
        description: `Blocked on: ${ob.steps[0]?.name ?? 'Unknown step'}${ob.steps[0]?.notes ? ` — ${ob.steps[0].notes}` : ''}`,
        type: 'event',
        severity: 'medium',
        client: ob.client.name,
        timestamp: new Date(ob.updatedAt),
      })
    })

    // High urgency tax insights — from stored records
    const taxHigh = await prisma.taxInsight.findMany({
      where: { urgency: 'HIGH', status: 'UNDER_REVIEW' },
      include: { client: true },
      take: 2,
      orderBy: { createdAt: 'desc' },
    })
    taxHigh.forEach((t) => {
      alerts.push({
        id: `tax-${t.id}`,
        title: `Tax Review: ${t.title}`,
        // Use stored rationale — do not truncate with "..."  that can cut mid-sentence
        description: t.rationale.length > 150 ? t.rationale.slice(0, 147) + '...' : t.rationale,
        type: 'tax',
        severity: 'high',
        client: t.client.name,
        timestamp: new Date(t.createdAt),
      })
    })

    return alerts.slice(0, 8)
  }

  static async getRevenueDrafts() {
    const ops = await prisma.opportunity.findMany({
      where: { status: { in: ['DRAFT', 'PENDING_REVIEW'] } },
      orderBy: { confidence: 'desc' },
      take: 5,
      include: { client: true },
    })
    return ops.map((op) => ({
      id: op.id,
      type: op.type.replace(/_/g, ' '),
      client: op.client.name,
      value: op.valueEst
        ? op.valueEst >= 1_000_000
          ? `$${(op.valueEst / 1_000_000).toFixed(1)}M`
          : `$${(op.valueEst / 1_000).toFixed(0)}k`
        : 'Value not estimated',
      confidence: Math.round(op.confidence),
      suggestedAction: op.suggestedAction,
      status: op.status,
    }))
  }

  /**
   * Chart data — computed from actual client AUM at this point in time.
   * Note: No historical time series exists in the DB. This chart shows the
   * current AUM distribution across clients, not a growth trend.
   * Label this clearly in the UI.
   */
  static async getChartData() {
    const clients = await prisma.client.findMany({
      select: { name: true, aum: true, type: true },
      where: { aum: { not: null } },
      orderBy: { aum: 'desc' },
      take: 8,
    })

    // Return per-client AUM data — not a fabricated time series
    return clients.map((c) => ({
      name: c.name.split(' ')[0], // First word for display
      aum: Math.round((c.aum ?? 0) / 1_000_000 * 10) / 10, // $M
      type: c.type,
    }))
  }

  /**
   * Summary stats for the intelligence overview — all from DB.
   */
  static async getIntelligenceSummary(orgId: string) {
    const [
      totalOpps,
      totalTax,
      totalCompliance,
      clientCount,
      tasksDue,
    ] = await Promise.all([
      prisma.opportunity.count({ where: { status: 'DRAFT', client: { organizationId: orgId } } }),
      prisma.taxInsight.count({ where: { status: 'UNDER_REVIEW', client: { organizationId: orgId } } }),
      prisma.complianceFlag.count({ where: { status: 'OPEN', organizationId: orgId } }),
      prisma.client.count({ where: { organizationId: orgId } }),
      prisma.task.count({ where: { isCompleted: false, dueDate: { lt: new Date() } } }),
    ])

    return { totalOpps, totalTax, totalCompliance, clientCount, tasksDue }
  }
}
