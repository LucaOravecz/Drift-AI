/**
 * Tax Engine — Transparent, Evidence-Based Insight Rules
 *
 * All tax insights are draft observations for CPA/advisor review only.
 * Not tax advice. Not calculations. Not guarantees.
 *
 * For each rule:
 * - State exactly what data triggered it
 * - State what the rule checks
 * - State what data is missing that would make this more accurate
 * - Never invent dollar amounts or percentages not backed by stored data
 * - Confidence reflects quality of available data, not assumed certainty
 */

import { DataConfidence } from "./grounded-output"

export interface TaxRule {
  id: string
  name: string
  category: string
  rule: string                     // Human-readable rule description
  dataRequired: string[]           // DB fields needed to evaluate this rule
  missingDataMessage: string       // What to show if data is missing
  confidenceExplanation: string    // How confidence was determined
}

export interface TaxInsightEvaluation {
  ruleId: string
  triggered: boolean
  confidence: DataConfidence
  triggerData: string              // What specific value triggered this
  evidence: string                 // Source record / field
  title: string
  rationale: string
  suggestedAction: string
  estimatedImpact: string | null   // Only if there is actual stored data to support an estimate
  limitation: string               // What this insight cannot determine
  missingData: string[]
  urgency: "HIGH" | "MEDIUM" | "LOW"
}

export const TAX_RULES: TaxRule[] = [
  {
    id: "rmd_review",
    name: "RMD Review Prompt",
    category: "RMD",
    rule: "If lifeStage = DISTRIBUTION, the client may be subject to Required Minimum Distributions",
    dataRequired: ["intelligenceProfiles.lifeStage"],
    missingDataMessage: "Life stage not recorded — cannot evaluate RMD applicability",
    confidenceExplanation: "MEDIUM — triggered by lifeStage field only; actual age and account types not stored",
  },
  {
    id: "niit_review",
    name: "NIIT Review Prompt",
    category: "ENTITY",
    rule: "If AUM > $4M, investment income may exceed the $200K NIIT threshold (single) or $250K (MFJ)",
    dataRequired: ["clients.aum", "clients.riskProfile"],
    missingDataMessage: "AUM not on file — cannot evaluate NIIT exposure",
    confidenceExplanation: "LOW — triggered by AUM stored value; actual income, filing status, and exemptions unknown",
  },
  {
    id: "liquidity_review",
    name: "Post-Liquidity Tax Planning Prompt",
    category: "CHARITABLE",
    rule: "If a BUSINESS_SALE, INHERITANCE, or LIQUIDITY life event is recorded, tax planning review is warranted",
    dataRequired: ["lifeEvents.type"],
    missingDataMessage: "No qualifying life event recorded",
    confidenceExplanation: "MEDIUM — triggered by life event record; actual proceeds, cost basis, and timing unknown",
  },
  {
    id: "contribution_deadline",
    name: "Contribution Opportunity Check",
    category: "CONTRIBUTION",
    rule: "If life stage is ACCUMULATION and accounts suggest tax-advantaged capacity may exist",
    dataRequired: ["intelligenceProfiles.lifeStage", "clients.aum"],
    missingDataMessage: "Life stage or AUM not recorded",
    confidenceExplanation: "LOW — triggered by life stage only; actual account types and contribution history unknown",
  },
]

/**
 * Evaluate a specific tax rule against stored client data.
 * Does NOT write to DB — evaluation only.
 */
export function evaluateTaxRule(
  ruleId: string,
  clientData: {
    clientId: string
    clientName: string
    aum: number | null
    riskProfile: string | null
    lifeStage: string | null
    hasLiquidityEvent: boolean
    liquidityEventTitle?: string
    liquidityEventId?: string
  }
): TaxInsightEvaluation | null {
  const { clientId, clientName, aum, riskProfile, lifeStage, hasLiquidityEvent } = clientData

  switch (ruleId) {
    case "rmd_review": {
      if (lifeStage !== "DISTRIBUTION") return null
      return {
        ruleId,
        triggered: true,
        confidence: "MEDIUM",
        triggerData: `intelligenceProfiles.lifeStage = "DISTRIBUTION"`,
        evidence: `intelligenceProfiles for client ${clientId}`,
        title: "RMD Review — Distribution Stage Detected",
        rationale: `Client life stage is recorded as DISTRIBUTION. Clients in this stage may be subject to Required Minimum Distributions from qualified accounts. This observation is based on the stored lifeStage field only.`,
        suggestedAction: "Review all qualified account balances (IRA, 401k) and confirm RMD obligations with CPA",
        estimatedImpact: null, // Cannot estimate without actual account balances and birth date
        limitation: "Cannot calculate actual RMD amounts — actual age, account type, and current balances are required. Consult CPA.",
        missingData: ["Client date of birth", "Account type breakdown", "Current qualified account balances"],
        urgency: "HIGH",
      }
    }

    case "niit_review": {
      if (!aum || aum <= 4_000_000) return null
      // State the AUM-based observation clearly without inventing income
      const aumDisplay = `$${(aum / 1_000_000).toFixed(1)}M`
      return {
        ruleId,
        triggered: true,
        confidence: "LOW",
        triggerData: `clients.aum = ${aum} (${aumDisplay})`,
        evidence: `clients.aum for client ${clientId}`,
        title: `NIIT Threshold Review — AUM ${aumDisplay}`,
        rationale: `Client AUM of ${aumDisplay} suggests potential investment income that may exceed NIIT thresholds ($200K single / $250K MFJ). This is a prompt for review only — not a calculation. Actual investment income and filing status are unknown.`,
        suggestedAction: "Review actual investment income with CPA to determine NIIT exposure",
        estimatedImpact: null, // Cannot estimate without actual income data
        limitation: "AUM alone does not determine NIIT liability. Actual investment income, realized gains, filing status, and other deductions are required. This is a review prompt only.",
        missingData: ["Actual investment income", "Filing status", "Realized capital gains", "Other NIIT deductions"],
        urgency: "MEDIUM",
      }
    }

    case "liquidity_review": {
      if (!hasLiquidityEvent) return null
      return {
        ruleId,
        triggered: true,
        confidence: "MEDIUM",
        triggerData: `lifeEvents.type ∈ [BUSINESS_SALE, INHERITANCE, LIQUIDITY] — event: "${clientData.liquidityEventTitle ?? "recorded event"}"`,
        evidence: clientData.liquidityEventId
          ? `lifeEvents:${clientData.liquidityEventId}`
          : `lifeEvents for client ${clientId}`,
        title: "Post-Liquidity Tax Planning Review",
        rationale: `A liquidity event (${clientData.liquidityEventTitle ?? "business sale, inheritance, or other inflow"}) has been recorded. Major liquidity events often create tax planning considerations including capital gains timing, charitable giving strategies, and qualified opportunity zones. This is a review prompt — actual tax implications depend on details not in the system.`,
        suggestedAction: "Schedule tax planning review with CPA to evaluate capital gains timing and mitigation strategies",
        estimatedImpact: null, // Cannot estimate without actual proceeds and cost basis
        limitation: "Cannot calculate tax impact without actual proceeds, cost basis, event date, and tax year details. This is a flag for advisor/CPA attention, not an estimate.",
        missingData: ["Event proceeds / amount", "Asset cost basis", "Tax year of event", "State tax implications"],
        urgency: "HIGH",
      }
    }

    case "contribution_deadline": {
      if (lifeStage !== "ACCUMULATION" || !aum) return null
      return {
        ruleId,
        triggered: true,
        confidence: "LOW",
        triggerData: `intelligenceProfiles.lifeStage = "ACCUMULATION", clients.aum = ${aum}`,
        evidence: `intelligenceProfiles and clients for client ${clientId}`,
        title: "Tax-Advantaged Contribution Review",
        rationale: `Client is in ACCUMULATION stage. Annual review of tax-advantaged account contributions (IRA, 401k, HSA) is recommended to ensure available contribution capacity is being utilized.`,
        suggestedAction: "Confirm current-year contributions across all tax-advantaged accounts with CPA",
        estimatedImpact: null,
        limitation: "Cannot evaluate actual contribution capacity without knowing account types held, current contributions, and income levels.",
        missingData: ["Account types held", "Current year contributions", "Income level", "Employer match details"],
        urgency: "LOW",
      }
    }

    default:
      return null
  }
}

export const TAX_ENGINE_DISCLAIMER =
  "Tax insights are draft observations generated by rule-based detection from stored client data. They are NOT tax advice, calculations, or guarantees. All insights require review by a licensed CPA or tax professional before any action is taken. Confidence levels reflect data availability only."
