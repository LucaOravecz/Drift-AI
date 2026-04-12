import prisma from '../db'

export class OnboardingService {
  static async getWorkflows() {
    return prisma.onboardingWorkflow.findMany({
      include: {
        client: true,
        steps: { orderBy: { id: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  static async getStats() {
    const workflows = await prisma.onboardingWorkflow.findMany({
      include: { steps: true },
    })

    const total = workflows.length
    const complete = workflows.filter((w) => w.stage === 'COMPLETE').length
    const blocked = workflows.filter((w) =>
      w.steps.some((s) => s.status === 'BLOCKED')
    ).length
    const healthy = workflows.filter(
      (w) => w.healthScore >= 70 && w.stage !== 'COMPLETE'
    ).length
    const avgHealth =
      total > 0
        ? Math.round(workflows.reduce((s, w) => s + w.healthScore, 0) / total)
        : 0

    return { total, complete, blocked, healthy, avgHealth }
  }

  static stageOrder = [
    'LEAD',
    'QUALIFICATION',
    'DISCOVERY',
    'INTAKE',
    'DOCS_REQUESTED',
    'DOCS_RECEIVED',
    'REVIEW',
    'PROPOSAL',
    'SIGNED',
    'ACCOUNT_SETUP',
    'COMPLETE',
  ]

  static getStageProgress(stage: string): number {
    const idx = OnboardingService.stageOrder.indexOf(stage)
    if (idx === -1) return 0
    return Math.round(((idx + 1) / OnboardingService.stageOrder.length) * 100)
  }

  static getStepProgress(steps: { status: string }[]): number {
    if (!steps.length) return 0
    const completed = steps.filter((s) => s.status === 'COMPLETED').length
    return Math.round((completed / steps.length) * 100)
  }
}
