/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '../db'
import { ClientMemoryService } from './client-memory.service'

export class ClientService {
  static async getClients() {
    const clients = await prisma.client.findMany({
      include: { intelligence: true },
      orderBy: { createdAt: 'desc' },
    })
    return clients.map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      email: c.email,
      aum: c.aum
        ? c.aum >= 1000000
          ? `$${(c.aum / 1000000).toFixed(1)}M`
          : `$${(c.aum / 1000).toFixed(0)}k`
        : '$0',
      riskProfile: c.riskProfile ?? 'Unknown',
      churnScore: c.churnScore,
      lastContact: c.lastContactAt ? c.lastContactAt.toLocaleDateString() : 'Never',
      sentiment: c.intelligence?.sentimentScore ?? 50,
      tags: c.tags ? c.tags.split(',') : [],
    }))
  }

  static async getClientDetail(id: string) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        intelligence: true,
        opportunities: { orderBy: { createdAt: 'desc' } },
        taxInsights: { orderBy: { createdAt: 'desc' } },
        investInsights: { orderBy: { createdAt: 'desc' } },
        events: { orderBy: { createdAt: 'desc' } },
        meetings: { orderBy: { scheduledAt: 'desc' }, take: 5 },
        communications: { orderBy: { timestamp: 'desc' }, take: 10 },
        relationshipEvents: { orderBy: { eventDate: 'asc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
        tasks: { where: { isCompleted: false }, orderBy: { dueDate: 'asc' } },
        onboarding: { include: { steps: true } },
        researchMemos: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    })

    if (!client) return null

    let memorySnapshot = await ClientMemoryService.getLatestSnapshot(id)
    if (!memorySnapshot) {
      memorySnapshot = await ClientMemoryService.refreshSnapshot(id).then((result) => ({
        ...result.snapshot,
        payload: result.profile,
        missingData: result.profile.missingData,
      }))
    }

    return {
      ...client,
      memorySnapshot
    }
  }
}
