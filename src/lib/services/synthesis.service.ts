/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '../db'

export interface ComprehensiveProfile {
  client: any
  intelligence: any
  accounts: any[]
  communications: any[]
  opportunities: any[]
  taxInsights: any[]
  investmentInsights: any[]
  lifeEvents: any[]
  documents: any[]
  meetings: any[]
  tasks: any[]
  onboarding: any | null
}

export class SynthesisService {
  /**
   * Aggregates ALL available client data into a single, dense synthesis object.
   * This ensures AI insights are generated from a "Full Client Profile" rather than isolated inputs.
   */
  static async getComprehensiveProfile(clientId: string): Promise<ComprehensiveProfile> {
    const [
      client,
      intelligence,
      accounts,
      communications,
      opportunities,
      taxInsights,
      investmentInsights,
      lifeEvents,
      documents,
      meetings,
      tasks,
      onboarding
    ] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId } }),
      prisma.intelligenceProfile.findUnique({ where: { clientId } }),
      prisma.financialAccount.findMany({
        where: { clientId },
        include: {
          holdings: {
            orderBy: { marketValue: 'desc' },
            take: 10,
          },
        },
      }),
      prisma.communication.findMany({ 
        where: { clientId }, 
        orderBy: { timestamp: 'desc' }, 
        take: 10,
        select: { type: true, direction: true, subject: true, body: true, status: true, timestamp: true }
      }),
      prisma.opportunity.findMany({ where: { clientId, status: { not: 'REJECTED' } } }),
      prisma.taxInsight.findMany({ where: { clientId, status: { in: ['UNDER_REVIEW', 'ACCEPTED'] } } }),
      prisma.investmentInsight.findMany({ where: { clientId, status: { in: ['UNDER_REVIEW', 'REVIEWED'] } } }),
      prisma.lifeEvent.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.document.findMany({ 
        where: { clientId }, 
        select: { fileName: true, documentType: true, summaryText: true, uploadedAt: true } 
      }),
      prisma.meeting.findMany({ 
        where: { clientId }, 
        orderBy: { scheduledAt: 'desc' }, 
        take: 5,
        select: { title: true, type: true, scheduledAt: true, status: true, notes: true }
      }),
      prisma.task.findMany({ where: { clientId, isCompleted: false }, take: 10 }),
      prisma.onboardingWorkflow.findUnique({ where: { clientId }, include: { steps: true } })
    ])

    if (!client) throw new Error('Client not found')

    return {
      client,
      intelligence,
      accounts,
      communications,
      opportunities,
      taxInsights,
      investmentInsights,
      lifeEvents,
      documents,
      meetings,
      tasks,
      onboarding
    }
  }

  /**
   * Serializes the comprehensive profile into an AI-optimized string.
   */
  static serializeForAI(profile: ComprehensiveProfile): string {
    return JSON.stringify({
      identity: {
        name: profile.client.name,
        type: profile.client.type,
        tags: profile.client.tags,
        aum: profile.client.aum,
        risk: profile.client.riskProfile,
      },
      intelligence: {
        stage: profile.intelligence?.lifeStage,
        goals: profile.intelligence?.goals,
        concerns: profile.intelligence?.concerns,
        sentiment: profile.intelligence?.sentimentScore,
        strength: profile.intelligence?.relationStrength,
      },
      portfolioSnapshot: {
        accounts: profile.accounts.map((account) => ({
          name: account.accountName,
          type: account.accountType,
          currentValue: account.currentValue,
          cashBalance: account.cashBalance,
          targets: {
            equities: account.targetEquities,
            fixedIncome: account.targetFixedIncome,
            cash: account.targetCash,
            alternatives: account.targetAlternatives,
          },
          topHoldings: account.holdings.map((holding: any) => ({
            symbol: holding.symbol,
            assetClass: holding.assetClass,
            marketValue: holding.marketValue,
            weightPercent: holding.weightPercent,
          })),
        })),
      },
      activeIntelligence: {
        taxOpportunities: profile.taxInsights.map(t => ({ title: t.title, impact: t.estimatedImpact })),
        investmentThemes: profile.investmentInsights.map(i => ({ title: i.title, assets: i.assetTicker })),
        revenueTriggers: profile.opportunities.map(o => ({ type: o.type, value: o.valueEst })),
      },
      behaviorAndTiming: {
        recentEvents: profile.lifeEvents.map(e => e.title),
        lastOutreachDays: profile.communications[0] 
          ? Math.round((Date.now() - profile.communications[0].timestamp.getTime()) / (1000 * 60 * 60 * 24))
          : 'NEVER',
        outstandingTasks: profile.tasks.length,
        documentTypesHeld: profile.documents.map(d => d.documentType),
        upcomingMeeting: profile.meetings.find(m => m.status === 'SCHEDULED')?.scheduledAt,
      },
      strategicContext: {
        significantTaxFootprint: profile.taxInsights.length > 0,
        unmetLifeGoalTriggers: profile.lifeEvents.some(e => e.type === 'RETIREMENT' || e.type === 'BUSINESS_SALE'),
        relationshipHealth: profile.intelligence?.sentimentScore,
      },
      historyNotes: profile.communications.map(c => 
        `[${c.timestamp.toISOString().split('T')[0]}] ${c.subject}: ${c.body?.substring(0, 400)}...`
      ).join('\n---\n'),
    }, null, 2)
  }
}
