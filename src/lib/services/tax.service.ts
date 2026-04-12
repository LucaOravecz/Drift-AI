import prisma from '../db'
import { evaluateTaxRule, TAX_RULES, TAX_ENGINE_DISCLAIMER } from '../engines/tax.engine'
import { confidenceToScore, serializeFinding } from '../findings'

export class TaxService {
  private static async resolveOrgId(orgId?: string): Promise<string> {
    if (orgId) return orgId
    const org = await prisma.organization.findFirst()
    return org?.id ?? ''
  }

  static async getTaxInsights() {
    return prisma.taxInsight.findMany({
      include: { client: true },
      orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
    })
  }

  static async getStats() {
    const [total, underReview, accepted, dismissed, highUrgency] = await Promise.all([
      prisma.taxInsight.count(),
      prisma.taxInsight.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.taxInsight.count({ where: { status: 'ACCEPTED' } }),
      prisma.taxInsight.count({ where: { status: 'DISMISSED' } }),
      prisma.taxInsight.count({ where: { urgency: 'HIGH', status: 'UNDER_REVIEW' } }),
    ])
    return { total, underReview, accepted, dismissed, highUrgency }
  }

  /**
   * Runs tax insight rules against stored client data.
   *
   * RULES:
   * 1. Only create insights where rules are actually triggered by stored data
   * 2. Do NOT invent dollar amounts, percentages, or impact estimates
   * 3. Every insight includes its trigger data so advisors know what triggered it
   * 4. Insights are clearly labeled as "draft observations — CPA review required"
   * 5. AUM-based rules label the estimate as "estimated from AUM — not from actual income"
   * 6. Do NOT claim specific IRS penalties, specific percentages saved, or specific tax amounts
   * 7. Skip clients that already have an insight of that type
   *
   * Confidence mapping:
   * - HIGH: triggered by explicit stored data (lifeStage, life event ID)
   * - MEDIUM: triggered by AUM field (a proxy, not actual income data)
   * - LOW: triggered by weak signals
   */
  static async runTaxScan(orgId: string) {
    const clients = await prisma.client.findMany({
      where: { organizationId: orgId },
      include: {
        intelligence: true,
        taxInsights: true,
        events: {
          where: { type: { in: ['BUSINESS_SALE', 'INHERITANCE', 'LIQUIDITY'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    let created = 0

    for (const client of clients) {
      const existingCategories = client.taxInsights.map((t) => t.category ?? '')
      const liquidityEvent = client.events[0] ?? null

      const clientData = {
        clientId: client.id,
        clientName: client.name,
        aum: client.aum,
        riskProfile: client.riskProfile,
        lifeStage: client.intelligence?.lifeStage ?? null,
        hasLiquidityEvent: !!liquidityEvent,
        liquidityEventTitle: liquidityEvent?.title,
        liquidityEventId: liquidityEvent?.id,
      }

      for (const rule of TAX_RULES) {
        // Skip if we already have an insight for this category
        if (existingCategories.includes(rule.category)) continue

        const evaluation = evaluateTaxRule(rule.id, clientData)
        if (!evaluation || !evaluation.triggered) continue

        await prisma.taxInsight.create({
          data: {
            clientId: client.id,
            title: evaluation.title,
            category: rule.category,
            rationale: evaluation.rationale,
            // Evidence field now explicitly states the trigger data
            evidence: `Trigger: ${evaluation.triggerData}\nSource: ${evaluation.evidence}\nConfidence: ${evaluation.confidence} — ${TAX_RULES.find(r => r.id === rule.id)?.confidenceExplanation}`,
            urgency: evaluation.urgency,
            estimatedImpact: evaluation.estimatedImpact ?? TAX_ENGINE_DISCLAIMER,
            suggestedAction: evaluation.suggestedAction,
            status: 'UNDER_REVIEW',
            explanation: serializeFinding({
              insight: evaluation.rationale,
              trigger: evaluation.triggerData,
              evidence: [evaluation.evidence],
              whyItMatters: rule.category === 'RMD'
                ? 'Distribution-stage clients may have mandatory distribution obligations that require advisor and CPA review.'
                : rule.category === 'CHARITABLE'
                ? 'Large liquidity events often create planning windows that can materially affect tax strategy.'
                : 'A tax planning prompt was triggered from stored data and should be reviewed before client communication.',
              consequenceIfIgnored: evaluation.urgency === 'HIGH'
                ? 'Time-sensitive planning opportunities or obligations may be missed.'
                : 'Potential planning opportunities may remain unidentified or unreviewed.',
              nextBestAction: evaluation.suggestedAction,
              confidence: evaluation.confidence,
              reviewRequired: true,
              missingData: evaluation.missingData,
            }),
            confidence: confidenceToScore(evaluation.confidence),
          },
        })
        created++
      }
    }

    return { created, disclaimer: TAX_ENGINE_DISCLAIMER }
  }
}
