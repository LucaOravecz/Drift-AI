import "server-only"

import prisma from '@/lib/db'
import { authenticateApiRequest, hasPermission } from '@/lib/middleware/api-auth'

export async function GET(_request: Request) {
  const auth = await authenticateApiRequest()
  if (!auth.authenticated || !auth.context) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.statusCode ?? 401 })
  }

  if (!hasPermission(auth.context, 'read', 'intelligence')) {
    return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403 })
  }

  try {
    // Fetch priority alerts (churn, opportunities, compliance, onboarding blocks)
    const [churnFlags, opportunities, complianceFlags, blockedOnboarding] = await Promise.all([
      prisma.client.findMany({
        where: { organizationId: auth.context.organizationId, churnScore: { gte: 70 } },
        select: { id: true, name: true, churnScore: true },
        take: 3,
      }),
      prisma.opportunity.findMany({
        where: { client: { organizationId: auth.context.organizationId }, status: 'DRAFT' },
        select: { id: true, clientId: true, type: true, valueEst: true, description: true },
        take: 3,
      }),
      prisma.complianceFlag.findMany({
        where: { organizationId: auth.context.organizationId, status: { in: ['OPEN', 'ESCALATED'] } },
        select: { id: true, type: true, severity: true, description: true, target: true },
        take: 3,
      }),
      prisma.onboardingWorkflow.findMany({
        where: { client: { organizationId: auth.context.organizationId }, stage: 'BLOCKED' },
        select: { id: true, clientId: true, notes: true },
        take: 3,
      }),
    ])

    // Resolve client names for opportunities and onboarding
    const oppClientIds = opportunities.map((o) => o.clientId)
    const onboardClientIds = blockedOnboarding.map((b) => b.clientId)
    const clientIds = [...new Set([...oppClientIds, ...onboardClientIds])]
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true },
    })
    const clientNameMap = new Map(clients.map((c) => [c.id, c.name]))

    // Synthesize into alerts array
    const synthesizedAlerts = [
      ...churnFlags.map((c) => ({
        id: `churn-${c.id}`,
        title: `Churn Risk: ${c.name}`,
        description: `Client churn score: ${c.churnScore}% — recommend outreach`,
        type: 'risk',
        severity: c.churnScore >= 80 ? 'critical' : 'high',
        client: c.name,
        timestamp: new Date(),
      })),
      ...opportunities.map((o) => ({
        id: `opp-${o.id}`,
        title: `${o.type} Opportunity`,
        description: `${clientNameMap.get(o.clientId) ?? 'Unknown'} — $${o.valueEst ?? 0}. Awaiting advisor action.`,
        type: 'opportunity',
        severity: 'medium',
        client: clientNameMap.get(o.clientId) ?? 'Unknown',
        timestamp: new Date(),
      })),
      ...complianceFlags.map((c) => ({
        id: `comp-${c.id}`,
        title: `${c.type} Compliance Flag`,
        description: `${c.target} — ${c.description}`,
        type: 'compliance',
        severity: c.severity === 'CRITICAL' ? 'critical' : 'high',
        client: c.target,
        timestamp: new Date(),
      })),
      ...blockedOnboarding.map((b) => ({
        id: `onboard-${b.id}`,
        title: 'Onboarding Blocked',
        description: `${clientNameMap.get(b.clientId) ?? 'Unknown'} — ${b.notes ?? 'awaiting advisor input'}`,
        type: 'onboarding',
        severity: 'high',
        client: clientNameMap.get(b.clientId) ?? 'Unknown',
        timestamp: new Date(),
      })),
    ]

    return new Response(
      JSON.stringify({ alerts: synthesizedAlerts.slice(0, 10), success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[API] Alert polling failed:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch alerts', success: false }),
      { status: 500 }
    )
  }
}
