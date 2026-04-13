import prisma from '../db'
import { SynthesisService } from './synthesis.service'
import { callClaudeJSON } from './ai.service'

export interface MacroEvent {
  id: string
  title: string
  category: 'RATE_CHANGE' | 'SECTOR_VOLATILITY' | 'TAX_LAW' | 'GEOPOLITICAL' | 'EARNINGS'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  summary: string
  triggeredAt: Date
  affectedClients: AffectedClient[]
}

export interface AffectedClient {
  clientId: string
  clientName: string
  aum: number
  exposureRationale: string
  urgency: 'MONITOR' | 'REVIEW' | 'IMMEDIATE_ACTION'
  recommendedPlay: string
}

// Institutional macro signals — in production, these would be sourced from
// Bloomberg Terminal, Reuters Eikon, or a financial data vendor (e.g., Quandl/FRED)
const MACRO_SIGNALS: Array<{
  id: string
  title: string
  category: MacroEvent['category']
  severity: MacroEvent['severity']
  summary: string
}> = [
  {
    id: 'rate-hike-q2',
    title: 'Fed Rate Decision: +25bps Expected',
    category: 'RATE_CHANGE' as const,
    severity: 'HIGH' as const,
    summary: 'Federal Reserve telegraphing 25bps rate increase. Duration extension risk in fixed income portfolios. Floating rate beneficiaries: real estate debt, bank equities.',
  },
  {
    id: 'tech-rotation',
    title: 'Institutional Rotation: Tech → Value',
    category: 'SECTOR_VOLATILITY' as const,
    severity: 'MEDIUM' as const,
    summary: 'Hedge fund positioning data signals rotation away from mega-cap tech into energy and financials. Clients with >20% tech concentration face idiosyncratic drawdown risk.',
  },
  {
    id: 'niit-threshold-update',
    title: 'NIIT Threshold: $200k Unchanged in 2024',
    category: 'TAX_LAW' as const,
    severity: 'MEDIUM' as const,
    summary: 'Net Investment Income Tax thresholds remain unadjusted for inflation. Bracket creep is increasing effective NIIT burden for HNW households annually.',
  },
  {
    id: 'muni-spread',
    title: 'Muni Bond Spreads at 5-Year Tights',
    category: 'EARNINGS' as const,
    severity: 'LOW' as const,
    summary: 'Municipal bond tax-equivalent yields have compressed. High-tax bracket investors should reassess muni vs. taxable fixed income allocation.',
  },
]

export class NewsService {
  /**
   * Runs the Institutional News Oracle — correlates macro signals against each client's
   * specific portfolio, tax footprint, and life events to produce high-stakes alerts.
   */
  static async runNewsOracle(orgId: string): Promise<MacroEvent[]> {
    const clients = await prisma.client.findMany({
      where: { organizationId: orgId },
      include: {
        intelligence: true,
        taxInsights: { where: { status: 'UNDER_REVIEW' }, take: 3 },
        investInsights: { take: 3 },
        events: { orderBy: { createdAt: 'desc' }, take: 2 },
        opportunities: { where: { status: 'DRAFT' }, take: 3 },
      },
    })

    const results: MacroEvent[] = []

    for (const signal of MACRO_SIGNALS) {
      const affectedClients: AffectedClient[] = []

      for (const client of clients) {
        const exposed = NewsService.isClientExposed(client, signal)
        if (!exposed) continue

        try {
          const systemPrompt = `You are an elite institutional strategist. In 2 sentences maximum, state:
1. WHY this specific client is exposed to this macro signal (be quantitatively specific)
2. The SINGLE best immediate play to protect or capitalize on it.
No generic advice. Reference the client data. Start directly with the insight.`

          const clientData = {
            name: client.name,
            aum: client.aum,
            riskProfile: client.riskProfile,
            taxExposure: client.taxInsights.map((t: { title: string }) => t.title),
            investmentThemes: client.investInsights.map((i: { assetTicker: string | null }) => i.assetTicker),
            lifeEvents: client.events.map((e: { type: string | null }) => e.type),
            macroSignal: signal.title,
            signalSummary: signal.summary,
          }

          const result = await callClaudeJSON<{ rationale: string; play: string }>(
            systemPrompt,
            JSON.stringify(clientData),
            { maxTokens: 512, organizationId: orgId }
          )

          affectedClients.push({
            clientId: client.id,
            clientName: client.name,
            aum: client.aum ?? 0,
            exposureRationale: result.rationale ?? exposed,
            urgency: signal.severity === 'CRITICAL' ? 'IMMEDIATE_ACTION' : signal.severity === 'HIGH' ? 'REVIEW' : 'MONITOR',
            recommendedPlay: result.play ?? 'Review allocation in light of macro shift.',
          })
        } catch {
          affectedClients.push({
            clientId: client.id,
            clientName: client.name,
            aum: client.aum ?? 0,
            exposureRationale: exposed,
            urgency: signal.severity === 'CRITICAL' ? 'IMMEDIATE_ACTION' : 'REVIEW',
            recommendedPlay: `Review client's exposure to ${signal.category.replace(/_/g, ' ').toLowerCase()} risk.`,
          })
        }
      }

      if (affectedClients.length > 0) {
        results.push({
          ...signal,
          triggeredAt: new Date(),
          affectedClients: affectedClients.sort((a, b) => b.aum - a.aum),
        })
      }
    }

    return results
  }

  /**
   * Heuristic engine: determines if a client has meaningful exposure to a given macro signal.
   * Returns the rationale string if exposed, null if not.
   */
  private static isClientExposed(client: any, signal: typeof MACRO_SIGNALS[0]): string | null {
    const aum = client.aum ?? 0

    switch (signal.category) {
      case 'RATE_CHANGE':
        // Clients with significant AUM have duration risk in fixed income
        if (aum > 1_000_000) {
          return `With ${(aum / 1_000_000).toFixed(1)}M AUM, duration extension in fixed income creates meaningful mark-to-market risk.`
        }
        return null

      case 'SECTOR_VOLATILITY':
        // Clients with tech concentration via investInsights or tagged AAPL/NVDA/TSLA
        const hasTechConcentration = client.investInsights?.some(
          (i: any) => ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL'].includes(i.assetTicker ?? '')
        )
        if (hasTechConcentration) {
          return `Portfolio has identified single-stock tech concentration creating asymmetric sector-rotation risk.`
        }
        return null

      case 'TAX_LAW':
        // High AUM / clients with NIIT insights
        const estimatedIncome = aum * 0.05
        if (estimatedIncome > 150_000) {
          return `Estimated investment income of $${(estimatedIncome / 1000).toFixed(0)}k places client in NIIT bracket.`
        }
        return null

      case 'EARNINGS':
        // Clients with fixed income exposure
        const hasFixedIncome = client.taxInsights?.some(
          (t: any) => t.category === 'ENTITY' || t.title?.includes('Fixed Income') || t.title?.includes('NIIT')
        )
        if (hasFixedIncome) {
          return `Fixed income tax strategy needs reassessment given current muni spread compression.`
        }
        return null

      default:
        return null
    }
  }

  /**
   * Returns the latest macro signals for the dashboard without running full AI analysis.
   */
  static getLatestSignals() {
    return MACRO_SIGNALS.map(s => ({
      ...s,
      triggeredAt: new Date(),
    }))
  }
}
