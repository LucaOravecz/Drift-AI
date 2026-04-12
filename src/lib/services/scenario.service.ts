import { SynthesisService } from './synthesis.service'
import { callClaudeJSON } from './ai.service'
import prisma from '../db'

export interface ScenarioInput {
  clientId: string
  scenarioType: 'LIQUIDITY_EVENT' | 'MARKET_DRAWDOWN' | 'INTEREST_RATE_SHIFT' | 'BUSINESS_SALE' | 'INHERITANCE'
  magnitude: number    // Dollar amount or percentage depending on type
  timelineMonths: number
  description?: string
}

export interface ScenarioResult {
  scenarioTitle: string
  baselineState: BaselineState
  projectedState: ProjectedState
  highConvictionPlays: StrategicPlay[]
  riskOfInaction: string
  immediateNextStep: string
  generatedAt: string
}

interface BaselineState {
  currentAum: string
  currentRiskProfile: string
  topTaxRisk: string
  estimatedTaxLiability: string
}

interface ProjectedState {
  projectedAum: string
  deltaFromBaseline: string
  newTaxLiability: string
  concentrationRisk: string
}

interface StrategicPlay {
  priority: number
  title: string
  rationale: string
  estimatedImpact: string
  timeToExecute: string
}

export class ScenarioService {
  /**
   * Runs an asymmetric "What-If" scenario against the full client profile.
   * Returns high-conviction strategic plays and the consequence of inaction.
   */
  static async runScenario(input: ScenarioInput): Promise<ScenarioResult> {
    const profile = await SynthesisService.getComprehensiveProfile(input.clientId)
    const client = profile.client
    const currentAum = client.aum ?? 0

    // Build projected state deterministically
    let projectedAum = currentAum
    let newTaxLiability = 0
    let scenarioTitle = ''
    let concentrationRisk = 'Moderate'

    switch (input.scenarioType) {
      case 'LIQUIDITY_EVENT':
      case 'BUSINESS_SALE':
        projectedAum = currentAum + input.magnitude
        newTaxLiability = input.magnitude * 0.238 // Fed + state cap gains estimate
        scenarioTitle = `Business Sale / Liquidity Event: +$${(input.magnitude / 1_000_000).toFixed(1)}M`
        concentrationRisk = input.magnitude > 10_000_000 ? 'CRITICAL — Oversized cash position' : 'HIGH — Requires immediate deployment strategy'
        break

      case 'INHERITANCE':
        projectedAum = currentAum + input.magnitude
        newTaxLiability = input.magnitude * 0.04 // Estate planning acceleration costs
        scenarioTitle = `Inheritance Event: +$${(input.magnitude / 1_000_000).toFixed(1)}M`
        concentrationRisk = 'High — Beneficiary optimization required'
        break

      case 'MARKET_DRAWDOWN':
        projectedAum = currentAum * (1 - input.magnitude / 100)
        newTaxLiability = -Math.abs(projectedAum - currentAum) * 0.12 // Tax-loss harvesting potential
        scenarioTitle = `Market Drawdown Scenario: -${input.magnitude}%`
        concentrationRisk = 'Variable — Single-stock names at highest risk'
        break

      case 'INTEREST_RATE_SHIFT':
        const durationImpact = currentAum * 0.3 * (input.magnitude / 100) * -7 // ~7yr avg duration
        projectedAum = currentAum + durationImpact
        newTaxLiability = 0
        scenarioTitle = `Rate Shift Scenario: +${input.magnitude}bps`
        concentrationRisk = 'High — Fixed income duration creating mark-to-market losses'
        break
    }

    const delta = projectedAum - currentAum
    const baseline: BaselineState = {
      currentAum: `$${(currentAum / 1_000_000).toFixed(2)}M`,
      currentRiskProfile: client.riskProfile ?? 'Not specified',
      topTaxRisk: profile.taxInsights[0]?.title ?? 'None flagged',
      estimatedTaxLiability: `$${(currentAum * 0.025 / 1_000).toFixed(0)}k (est. annual)`,
    }

    const projected: ProjectedState = {
      projectedAum: `$${(projectedAum / 1_000_000).toFixed(2)}M`,
      deltaFromBaseline: `${delta >= 0 ? '+' : ''}$${(delta / 1_000_000).toFixed(2)}M`,
      newTaxLiability: `$${(Math.abs(newTaxLiability) / 1_000).toFixed(0)}k (est. event liability)`,
      concentrationRisk,
    }

    // Use AI to generate high-conviction plays if possible
    let plays: StrategicPlay[] = []
    let riskOfInaction = ''
    let immediateNextStep = ''

    try {
      const systemPrompt = `You are a Principal Wealth Architect running a "What-If" stress test for a high-net-worth client.
Based on the client profile and projected scenario, produce:
1. Three high-conviction strategic plays (ordered by priority)
2. A "Risk of Inaction" — what happens if no changes are made within ${input.timelineMonths} months
3. The single immediate next step the advisor should take this week

Style: Decisive, institutional, quantitative. No filler. Start with the insight.
Return JSON: { plays: [{priority, title, rationale, estimatedImpact, timeToExecute}], riskOfInaction, immediateNextStep }`

      const userMessage = `Client Profile: ${SynthesisService.serializeForAI(profile)}
Scenario: ${scenarioTitle}
Baseline AUM: ${baseline.currentAum}
Projected AUM: ${projected.projectedAum}
Delta: ${projected.deltaFromBaseline}
Estimated Tax Event: ${projected.newTaxLiability}
Concentration Risk: ${concentrationRisk}
Advisory Timeline: ${input.timelineMonths} months`

      const result = await callClaudeJSON<{
        plays: StrategicPlay[]
        riskOfInaction: string
        immediateNextStep: string
      }>(systemPrompt, userMessage, 2048)

      plays = result.plays ?? []
      riskOfInaction = result.riskOfInaction ?? ''
      immediateNextStep = result.immediateNextStep ?? ''
    } catch {
      // Deterministic fallback
      plays = ScenarioService.buildDeterministicPlays(input, projected, newTaxLiability)
      riskOfInaction = `Failing to act within ${input.timelineMonths} months risks maximum tax exposure of ${projected.newTaxLiability} with no shielding strategy in place.`
      immediateNextStep = 'Schedule an emergency tax strategy session with CPA and estate attorney to review liquidity deployment options before year-end.'
    }

    return {
      scenarioTitle,
      baselineState: baseline,
      projectedState: projected,
      highConvictionPlays: plays,
      riskOfInaction,
      immediateNextStep,
      generatedAt: new Date().toISOString(),
    }
  }

  private static buildDeterministicPlays(
    input: ScenarioInput,
    projected: ProjectedState,
    taxLiability: number
  ): StrategicPlay[] {
    const plays: StrategicPlay[] = []

    if (taxLiability > 500_000) {
      plays.push({
        priority: 1,
        title: 'Deploy Donor Advised Fund (DAF) Pre-Recognition',
        rationale: `Tax liability of ${projected.newTaxLiability} can be substantially offset by contributing appreciated assets to a DAF prior to sale execution.`,
        estimatedImpact: 'Up to 37% reduction in ordinary income from gains',
        timeToExecute: '2-4 weeks',
      })
    }

    plays.push({
      priority: plays.length + 1,
      title: 'Qualified Opportunity Zone (QOZ) Deferral Strategy',
      rationale: 'Deploy a portion of realized gains into a Qualified Opportunity Fund to defer recognition for up to 5 years and achieve step-up in basis.',
      estimatedImpact: '100% capital gains exclusion after 10-year hold',
      timeToExecute: '180-day window from recognition event',
    })

    plays.push({
      priority: plays.length + 1,
      title: 'Installment Sale Architecture',
      rationale: 'Structure business sale as an installment to spread ordinary income recognition across multiple tax years, avoiding single-year bracket compression.',
      estimatedImpact: 'Mitigates highest-bracket exposure by 30-40%',
      timeToExecute: 'Must negotiate prior to close',
    })

    return plays
  }
}
