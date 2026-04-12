import prisma from '../db'

export class MemoryService {
  /**
   * Institutional-grade synthesis engine.
   * Moves beyond basic field mapping into behavioral reasoning.
   */
  static async synthesizeRelationship(clientId: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        events: { orderBy: { createdAt: 'desc' }, take: 5 },
        meetings: { where: { status: 'COMPLETED' }, orderBy: { scheduledAt: 'desc' }, take: 3 },
        communications: { orderBy: { timestamp: 'desc' }, take: 20 },
        intelligence: true,
      },
    })

    if (!client) return 'No synthesis available.'

    // Sentiment from intelligence profile
    const currentSentiment = client.intelligence?.sentimentScore ?? 75
    let velocityText = ''
    if (currentSentiment >= 80) velocityText = 'Strong positive relationship engagement. '
    else if (currentSentiment < 50) velocityText = 'Relationship requires attention — low sentiment score detected. '

    // 2. Family & Interconnectivity Logic (Keyword-based institutional synthesis)
    let familyContext = ''
    const commsText = client.communications.map(c => c.body).join(' ').toLowerCase()
    const familyKeywords = ['spouse', 'wife', 'husband', 'son', 'daughter', 'trustee', 'beneficiary', 'child']
    const detected = familyKeywords.filter(k => commsText.includes(k))
    if (detected.length > 0) {
      familyContext = `Interaction history includes mentions of: ${detected.join(', ')}. `
    }

    // 3. Logic-driven narrative construction
    let narrative = `[SYSTEM SYNTHESIS] Client since ${client.createdAt.toLocaleDateString()}. `
    
    // Life Stage & Goals
    if (client.intelligence?.lifeStage) {
      narrative += `Currently in the ${client.intelligence.lifeStage.replace(/_/g, ' ').toLowerCase()} phase. `
    }
    
    // Sentiment Velocity
    narrative += velocityText

    // Family Context
    narrative += familyContext
    
    // Recent Milestones
    if (client.events.length > 0) {
      const topEvent = client.events[0]
      narrative += `Recently experienced a ${topEvent.title} event. `
      if (topEvent.implications) narrative += `${topEvent.implications} `
    }

    // Last Touch Point
    if (client.meetings.length > 0) {
      narrative += `Last formal review was on ${client.meetings[0].scheduledAt.toLocaleDateString()}. `
    }

    // Strategic Focus
    if (client.intelligence?.goals) {
      narrative += `AI focus remains on: ${client.intelligence.goals}`
    }

    return narrative
  }
}
