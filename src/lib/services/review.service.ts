import prisma from '../db'

export type ReviewItemType = 'COMPLIANCE' | 'TAX' | 'INVESTMENT' | 'ONBOARDING' | 'CHURN_RISK'

export interface ReviewItem {
  id: string
  type: ReviewItemType
  title: string
  clientName: string
  clientId: string
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  description: string
  sourceId: string
  createdAt: Date
}

export class ReviewService {
  /**
   * Consolidates all 'Billion Dollar Firm' priorities into a single dashboard queue.
   * This is the institutional 'System of Intelligence' approach.
   */
  static async getExecutiveQueue(orgId: string): Promise<ReviewItem[]> {
    const [flags, tax, lowSentiment, blockedSales] = await Promise.all([
      // 1. Critical Compliance Flags
      prisma.complianceFlag.findMany({
        where: { organizationId: orgId, status: 'OPEN', severity: { in: ['HIGH', 'CRITICAL'] } },
        include: { organization: true },
        take: 5
      }),
      // 2. High Urgency Tax Insights
      prisma.taxInsight.findMany({
        where: { status: 'UNDER_REVIEW', urgency: 'HIGH' },
        include: { client: true },
        take: 5
      }),
      // 3. High Churn Risk Clients
      prisma.client.findMany({
        where: { organizationId: orgId, churnScore: { gt: 75 } },
        take: 5
      }),
      // 4. Stalled Onboarding
      prisma.onboardingWorkflow.findMany({
        where: { steps: { some: { status: 'BLOCKED' } } },
        include: { client: true, steps: { where: { status: 'BLOCKED' } } },
        take: 5
      })
    ])

    const queue: ReviewItem[] = []

    flags.forEach((f: any) => queue.push({
      id: `flag-${f.id}`,
      type: 'COMPLIANCE',
      title: `Compliance: ${f.type.replace(/_/g, ' ')}`,
      clientName: 'Institutional Flag',
      clientId: f.targetId || '',
      priority: f.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      description: f.description,
      sourceId: f.id,
      createdAt: f.createdAt
    }))

    tax.forEach((t: any) => queue.push({
      id: `tax-${t.id}`,
      type: 'TAX',
      title: `Tax Strategy: ${t.title}`,
      clientName: t.client.name,
      clientId: t.clientId,
      priority: 'HIGH',
      description: t.rationale,
      sourceId: t.id,
      createdAt: t.createdAt
    }))

    lowSentiment.forEach((c: any) => queue.push({
      id: `churn-${c.id}`,
      type: 'CHURN_RISK',
      title: 'Relationship Health Warning',
      clientName: c.name,
      clientId: c.id,
      priority: 'CRITICAL',
      description: `Churn score exceeded 75. Behavioral patterns suggest departure risk.`,
      sourceId: c.id,
      createdAt: c.createdAt
    }))

    blockedSales.forEach((ob: any) => queue.push({
      id: `ob-${ob.id}`,
      type: 'ONBOARDING',
      title: `Onboarding Blocked: ${ob.steps[0]?.name}`,
      clientName: ob.client.name,
      clientId: ob.clientId,
      priority: 'MEDIUM',
      description: ob.steps[0]?.notes || 'Awaiting document verification.',
      sourceId: ob.id,
      createdAt: ob.createdAt
    }))

    return queue.sort((a, b) => {
        const priorityScore = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 }
        return priorityScore[b.priority] - priorityScore[a.priority] || b.createdAt.getTime() - a.createdAt.getTime()
    })
  }

  static async getQueueStats(orgId: string) {
    const items = await this.getExecutiveQueue(orgId)
    return {
        totalItems: items.length,
        criticalCount: items.filter(i => i.priority === 'CRITICAL').length,
        highCount: items.filter(i => i.priority === 'HIGH').length
    }
  }
}
