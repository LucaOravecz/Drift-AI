import prisma from '../db'

/**
 * Escalation Service
 * Hardens institutional response by promoting stagnant risks into urgent tasks.
 */
export class EscalationService {
  /**
   * Scans for unresolved compliance flags and escalates them into institutional tasks.
   * This provides a fail-safe against critical risks lingering in the compliance queue.
   */
  static async processEscalations(orgId: string) {
    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours

    const pendingReview = await prisma.complianceFlag.findMany({
      where: {
        organizationId: orgId,
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
        OR: [
          { severity: 'CRITICAL' }, // Escalate critical immediately
          { createdAt: { lt: staleThreshold } } // Escalate stale items
        ]
      }
    })

    let escalationsCount = 0

    for (const flag of pendingReview) {
      // Institutional Guard: Prevent duplicate task creation for the same escalation
      const existingTask = await prisma.task.findFirst({
        where: { description: { contains: `FLAG_REF:${flag.id}` } }
      })

      if (!existingTask) {
        // Find a suitable owner (Compliance Officer or Admin)
        const owner = await prisma.user.findFirst({
          where: { organizationId: orgId, role: { in: ['COMPLIANCE_OFFICER', 'ADMIN'] } }
        })

        await prisma.task.create({
          data: {
            userId: owner?.id || null,
            title: `GOVERNANCE ESCALATION: ${flag.type.replace(/_/g, ' ')}`,
            description: `${flag.description} | ACTION REQUIRED: Resolve within dashboard. [FLAG_REF:${flag.id}]`,
            priority: flag.severity === 'CRITICAL' ? 'URGENT' : 'HIGH',
            source: 'ALERT',
            isCompleted: false
          }
        })
        
        // Update flag status to ensure it's tracked as 'UNDER_REVIEW'
        if (flag.status === 'OPEN') {
          await prisma.complianceFlag.update({
            where: { id: flag.id },
            data: { status: 'UNDER_REVIEW' }
          });
        }
        
        escalationsCount++
      }
    }

    return { escalationsCount }
  }
}
