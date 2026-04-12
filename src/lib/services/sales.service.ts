import prisma from '../db'

export class SalesService {
  static stageOrder = [
    'LEAD',
    'QUALIFIED',
    'DISCOVERY',
    'PROPOSAL',
    'NEGOTIATION',
    'CLOSED_WON',
    'CLOSED_LOST',
  ]

  static async getProspects() {
    return prisma.prospect.findMany({
      include: { campaign: true },
      orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }],
    })
  }

  static async getCampaigns() {
    return prisma.campaign.findMany({
      include: { prospects: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getPipelineByStage() {
    const prospects = await prisma.prospect.findMany({
      include: { campaign: true },
      orderBy: { score: 'desc' },
    })

    const grouped: Record<string, typeof prospects> = {}
    for (const stage of SalesService.stageOrder) {
      grouped[stage] = prospects.filter((p) => p.stage === stage)
    }
    return grouped
  }

  static async getStats() {
    const prospects = await prisma.prospect.findMany()
    const total = prospects.length
    const hot = prospects.filter((p) => p.score >= 80).length
    const totalAum = prospects.reduce((s, p) => s + (p.estimatedAum ?? 0), 0)
    const byStage = SalesService.stageOrder.reduce(
      (acc, stage) => {
        acc[stage] = prospects.filter((p) => p.stage === stage).length
        return acc
      },
      {} as Record<string, number>
    )
    return {
      total,
      hot,
      totalPipelineAum: `$${(totalAum / 1000000).toFixed(1)}M`,
      byStage,
    }
  }

  static getStageProgress(stage: string): number {
    const idx = SalesService.stageOrder.indexOf(stage)
    if (idx === -1) return 0
    return Math.round(((idx + 1) / (SalesService.stageOrder.length - 2)) * 100)
  }

  static getScoreColor(score: number): string {
    if (score >= 85) return 'text-emerald-500'
    if (score >= 65) return 'text-amber-500'
    return 'text-zinc-400'
  }

  static getScoreBg(score: number): string {
    if (score >= 85) return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
    if (score >= 65) return 'bg-amber-500/10 border-amber-500/20 text-amber-400'
    return 'bg-zinc-800/50 border-white/10 text-zinc-400'
  }
}
