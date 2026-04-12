import prisma from '../db'
import { AuditService } from './audit.service'
import { serializeFinding, type FindingConfidence, confidenceToScore } from '../findings'

export interface Allocation {
  equities: number
  fixedIncome: number
  cash: number
  alternatives: number
}

type PortfolioFinding = {
  type: 'REBALANCE' | 'IDLE_CASH' | 'CONCENTRATION'
  title: string
  description: string
  evidence: string
  suggestedAction: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  confidence: FindingConfidence
  valueEst?: number | null
  whyItMatters: string
  consequenceIfIgnored: string
  missingData: string[]
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10
}

function allocationFromHoldings(holdings: { assetClass: string; marketValue: number }[], totalValue: number): Allocation {
  const sums = holdings.reduce(
    (acc, holding) => {
      const bucket = holding.assetClass.toUpperCase()
      if (bucket === 'EQUITY') acc.equities += holding.marketValue
      else if (bucket === 'FIXED_INCOME') acc.fixedIncome += holding.marketValue
      else if (bucket === 'CASH') acc.cash += holding.marketValue
      else acc.alternatives += holding.marketValue
      return acc
    },
    { equities: 0, fixedIncome: 0, cash: 0, alternatives: 0 }
  )

  if (totalValue <= 0) {
    return { equities: 0, fixedIncome: 0, cash: 0, alternatives: 0 }
  }

  return {
    equities: roundPercent((sums.equities / totalValue) * 100),
    fixedIncome: roundPercent((sums.fixedIncome / totalValue) * 100),
    cash: roundPercent((sums.cash / totalValue) * 100),
    alternatives: roundPercent((sums.alternatives / totalValue) * 100),
  }
}

function buildFindings(args: {
  target: Allocation
  actual: Allocation
  totalValue: number
  cashBalance: number
  holdings: { symbol: string; name: string; marketValue: number; weightPercent: number | null }[]
}): PortfolioFinding[] {
  const findings: PortfolioFinding[] = []
  const drifts = {
    equities: Math.abs(args.actual.equities - args.target.equities),
    fixedIncome: Math.abs(args.actual.fixedIncome - args.target.fixedIncome),
    cash: Math.abs(args.actual.cash - args.target.cash),
    alternatives: Math.abs(args.actual.alternatives - args.target.alternatives),
  }

  const largestDriftBucket = Object.entries(drifts).sort((a, b) => b[1] - a[1])[0]
  if (largestDriftBucket && largestDriftBucket[1] >= 5) {
    findings.push({
      type: 'REBALANCE',
      title: `Allocation drift in ${largestDriftBucket[0]}`,
      description: `Actual ${largestDriftBucket[0]} allocation is ${args.actual[largestDriftBucket[0] as keyof Allocation]}% versus target ${args.target[largestDriftBucket[0] as keyof Allocation]}%.`,
      evidence: `Target allocation ${JSON.stringify(args.target)} | Actual allocation ${JSON.stringify(args.actual)}`,
      suggestedAction: `Review trades needed to move ${largestDriftBucket[0]} closer to target while preserving tax and liquidity constraints.`,
      riskLevel: largestDriftBucket[1] >= 10 ? 'HIGH' : 'MEDIUM',
      confidence: 'HIGH',
      valueEst: args.totalValue * (largestDriftBucket[1] / 100),
      whyItMatters: 'Allocation drift can move the client away from the intended policy risk profile.',
      consequenceIfIgnored: 'Portfolio risk may remain outside target tolerance bands.',
      missingData: [],
    })
  }

  if (args.cashBalance > 0 && args.totalValue > 0) {
    const idleCashPct = (args.cashBalance / args.totalValue) * 100
    if (idleCashPct >= 12) {
      findings.push({
        type: 'IDLE_CASH',
        title: 'Idle cash exceeds threshold',
        description: `Cash balance is ${roundPercent(idleCashPct)}% of portfolio value.`,
        evidence: `cashBalance=${args.cashBalance}; totalValue=${args.totalValue}; idleCashPct=${roundPercent(idleCashPct)}%`,
        suggestedAction: 'Review cash reserve purpose and determine whether excess cash should be redeployed.',
        riskLevel: idleCashPct >= 18 ? 'HIGH' : 'MEDIUM',
        confidence: 'HIGH',
        valueEst: args.cashBalance,
        whyItMatters: 'Excess cash can create return drag and indicate incomplete portfolio implementation.',
        consequenceIfIgnored: 'Capital may remain under-allocated and portfolio objectives may lag.',
        missingData: [],
      })
    }
  }

  const concentrationHolding = [...args.holdings]
    .sort((a, b) => (b.weightPercent ?? 0) - (a.weightPercent ?? 0))[0]
  if (concentrationHolding && (concentrationHolding.weightPercent ?? 0) >= 15) {
    findings.push({
      type: 'CONCENTRATION',
      title: `${concentrationHolding.symbol} concentration exceeds policy threshold`,
      description: `${concentrationHolding.name} represents ${roundPercent(concentrationHolding.weightPercent ?? 0)}% of portfolio value.`,
      evidence: `${concentrationHolding.symbol} marketValue=${concentrationHolding.marketValue}; weightPercent=${roundPercent(concentrationHolding.weightPercent ?? 0)}%`,
      suggestedAction: `Review diversification options for ${concentrationHolding.symbol} and assess tax/liquidity constraints before trimming.`,
      riskLevel: (concentrationHolding.weightPercent ?? 0) >= 20 ? 'HIGH' : 'MEDIUM',
      confidence: 'HIGH',
      valueEst: concentrationHolding.marketValue,
      whyItMatters: 'A concentrated holding can dominate risk and create client-specific downside exposure.',
      consequenceIfIgnored: 'Single-name volatility may materially impair portfolio stability.',
      missingData: [],
    })
  }

  return findings
}

export class PortfolioService {
  static async analyzeDrift(clientId: string, orgId: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        accounts: {
          include: { holdings: true },
        },
        opportunities: { where: { type: { in: ['REBALANCE', 'IDLE_CASH'] }, status: { in: ['DRAFT', 'PENDING_REVIEW'] } } },
        investInsights: { where: { status: 'UNDER_REVIEW' } },
      },
    })

    if (!client || client.accounts.length === 0) {
      return { status: 'INSUFFICIENT_DATA' as const, reason: 'No financial accounts or holdings stored.' }
    }

    const holdings = client.accounts.flatMap((account) => account.holdings)
    const totalValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0)
    const totalCashBalance = client.accounts.reduce((sum, account) => sum + account.cashBalance, 0)
    const target: Allocation = {
      equities: client.accounts[0].targetEquities ?? 50,
      fixedIncome: client.accounts[0].targetFixedIncome ?? 30,
      cash: client.accounts[0].targetCash ?? 10,
      alternatives: client.accounts[0].targetAlternatives ?? 10,
    }
    const actual = allocationFromHoldings(holdings, totalValue)
    const findings = buildFindings({
      target,
      actual,
      totalValue,
      cashBalance: totalCashBalance,
      holdings,
    })

    for (const finding of findings) {
      if (finding.type === 'CONCENTRATION') {
        const exists = client.investInsights.some((insight) => insight.title === finding.title)
        if (!exists) {
          const serializedFinding = serializeFinding({
            insight: finding.description,
            trigger: finding.title,
            evidence: [finding.evidence],
            whyItMatters: finding.whyItMatters,
            consequenceIfIgnored: finding.consequenceIfIgnored,
            nextBestAction: finding.suggestedAction,
            confidence: finding.confidence,
            reviewRequired: true,
            missingData: finding.missingData,
          })

          await prisma.investmentInsight.create({
            data: {
              clientId,
              title: finding.title,
              assetTicker: finding.title.split(' ')[0],
              thesis: finding.description,
              risks: finding.consequenceIfIgnored,
              catalysts: finding.whyItMatters,
              questions: `${finding.suggestedAction} Review required before any client recommendation.`,
              confidence: confidenceToScore(finding.confidence),
              dataSources: serializedFinding,
              status: 'UNDER_REVIEW',
            },
          })
        }
      } else {
        const exists = client.opportunities.some((opportunity) => opportunity.type === finding.type)
        if (!exists) {
          await prisma.opportunity.create({
            data: {
              clientId,
              type: finding.type,
              confidence: confidenceToScore(finding.confidence),
              valueEst: finding.valueEst ?? null,
              description: `${finding.title}. ${finding.description}`,
              evidence: finding.evidence,
              reasoning: serializeFinding({
                insight: finding.description,
                trigger: finding.title,
                evidence: [finding.evidence],
                whyItMatters: finding.whyItMatters,
                consequenceIfIgnored: finding.consequenceIfIgnored,
                nextBestAction: finding.suggestedAction,
                confidence: finding.confidence,
                reviewRequired: true,
                missingData: finding.missingData,
              }),
              suggestedAction: finding.suggestedAction,
              status: 'DRAFT',
              riskLevel: finding.riskLevel,
            },
          })
        }
      }
    }

    await AuditService.logAction({
      organizationId: orgId,
      action: 'PORTFOLIO_SCAN_COMPLETED',
      target: `Client:${clientId}`,
      details: findings.length > 0
        ? `Portfolio scan created or confirmed ${findings.length} explainable finding(s).`
        : 'Portfolio scan completed with no findings above policy thresholds.',
      metadata: {
        target,
        actual,
        totalValue,
        totalCashBalance,
        findings,
      },
      aiInvolved: false,
      severity: 'INFO',
    })

    return {
      status: findings.length > 0 ? 'FINDINGS_CREATED' as const : 'CLEAR' as const,
      target,
      actual,
      findings,
    }
  }

  static async runGlobalPortfolioScan(orgId: string) {
    const clients = await prisma.client.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    })

    const results = []
    for (const client of clients) {
      results.push(await this.analyzeDrift(client.id, orgId))
    }

    return results
  }
}
