import prisma from '../db'
import { callClaude } from './ai.service'
import { AuditService } from './audit.service'
import { SynthesisService } from './synthesis.service'

export class ResearchService {
  static async getMemos() {
    return prisma.researchMemo.findMany({
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getInsights() {
    return prisma.investmentInsight.findMany({
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getConcentrationFlags() {
    return prisma.opportunity.findMany({
      where: { type: { in: ['REBALANCE', 'IDLE_CASH'] }, status: 'DRAFT' },
      include: { client: true },
    })
  }

  /**
   * Generates a research memo draft using stored client data as the basis.
   *
   * Rules:
   * 1. AI prompt explicitly requires grounding in provided data only
   * 2. No unsupported performance claims, macro conclusions, or invented catalysts
   * 3. If AI fails, the memo is saved as a structured template requiring manual completion
   * 4. The memo is always labeled DRAFT and requires advisor review
   * 5. generatedBy accurately describes what produced the content
   * 6. No fake trace IDs — audit log records the real memo ID
   */
  static async generateMemo(clientId: string, topic: string, orgId: string) {
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) throw new Error('Client not found')

    const profile = await SynthesisService.getComprehensiveProfile(clientId)

    // Build only the data that actually exists
    const availableData = {
      clientName: client.name,
      riskProfile: client.riskProfile ?? null,
      aum: client.aum ? `$${(client.aum / 1_000_000).toFixed(1)}M` : null,
      lifeStage: profile.intelligence?.lifeStage ?? null,
      goals: profile.intelligence?.goals ?? null,
      concerns: profile.intelligence?.concerns ?? null,
      openOpportunities: profile.opportunities.map(o => ({ type: o.type, description: o.description })),
      taxInsights: profile.taxInsights.map(t => ({ title: t.title, category: t.category })),
      lifeEvents: profile.lifeEvents.map(e => ({ title: e.title, type: e.type })),
      topic,
    }

    const hasAdequateData =
      (availableData.goals || availableData.concerns || availableData.openOpportunities.length > 0)

    let title = ''
    let thesis = ''
    let risks = ''
    let catalysts = ''
    let questions = ''
    let sources = ''
    let generatedBy = 'MANUAL_TEMPLATE'

    if (hasAdequateData) {
      try {
        const systemPrompt = `You are a financial advisor writing an internal research memo for your own use.

STRICT RULES — follow exactly:
1. Only reference information explicitly provided in the client data below
2. Do NOT invent specific returns, alpha, percentage gains, or performance figures
3. Do NOT make market predictions or macro claims unless they are in the input data
4. If data is missing, write "Insufficient data — requires advisor input" in that section
5. The memo is a DRAFT for advisor review — not final investment advice
6. Be direct and specific about what is known vs unknown
7. Do not use marketing language like "elite", "institutional-grade", "alpha catalysts"`

        const userMessage = `Write an internal research memo for topic: "${topic}"
Client: ${client.name}

Available data:
${JSON.stringify(availableData, null, 2)}

Return JSON with these exact fields:
{
  "title": "Research Memo: [topic] — [client name]",
  "thesis": "What the available data suggests about this topic for this client. Be specific about what data supports this.",
  "risks": "Known risks or data gaps that affect this analysis",
  "catalysts": "Factors from the client profile that are relevant to this topic",
  "questions": "Questions the advisor should answer with the client to improve this analysis",
  "sources": "List the specific data fields used from the client profile"
}`

        const text = await callClaude(systemPrompt, userMessage, 2048)

        // Extract JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('No JSON found in AI response')

        const parsed = JSON.parse(jsonMatch[0]) as {
          title: string
          thesis: string
          risks: string
          catalysts: string
          questions: string
          sources: string
        }

        title = parsed.title || `Research Memo: ${topic} — ${client.name}`
        thesis = parsed.thesis
        risks = parsed.risks
        catalysts = parsed.catalysts
        questions = parsed.questions
        sources = parsed.sources
        generatedBy = 'AI_DRAFT'
      } catch (err) {
        console.warn('[ResearchService] AI memo generation failed:', err)
        // Honest template — labeled as incomplete
        title = `Research Memo: ${topic} — ${client.name}`
        thesis = `[AI generation failed — advisor input required]\n\nTopic: ${topic}\nClient: ${client.name}\n\n` +
          `Available context:\n` +
          (availableData.goals ? `Goals: ${availableData.goals}\n` : '') +
          (availableData.concerns ? `Concerns: ${availableData.concerns}\n` : '') +
          (availableData.riskProfile ? `Risk Profile: ${availableData.riskProfile}\n` : '') +
          `\nPlease complete this memo based on your analysis of the above.`
        risks = `[To be completed by advisor]`
        catalysts = `[To be completed by advisor]`
        questions = `What are the key questions to discuss with ${client.name} regarding ${topic}?`
        sources = `Client profile: ${JSON.stringify(availableData)}`
        generatedBy = 'TEMPLATE_INCOMPLETE'
      }
    } else {
      // Not enough data to generate anything meaningful
      title = `Research Memo: ${topic} — ${client.name}`
      thesis = `[Insufficient data to generate analysis]\n\n` +
        `Client profile does not have enough information to generate a grounded research memo for "${topic}".\n\n` +
        `Missing data that would help:\n` +
        `- Client goals (intelligenceProfiles.goals)\n` +
        `- Client concerns (intelligenceProfiles.concerns)\n` +
        `- Risk profile\n` +
        `- Open opportunities or life events\n\n` +
        `Please complete the client profile before generating research memos.`
      risks = `Cannot assess — insufficient client data`
      catalysts = `Cannot assess — insufficient client data`
      questions = `What are this client's investment goals and concerns regarding ${topic}?`
      sources = `No adequate data sources found in client profile`
      generatedBy = 'INSUFFICIENT_DATA'
    }

    const memo = await prisma.researchMemo.create({
      data: {
        clientId,
        title,
        assetOrSector: topic,
        thesis,
        risks,
        catalysts,
        questions,
        sources,
        status: 'DRAFT',
        generatedBy,
      },
    })

    await AuditService.logAction({
      organizationId: orgId,
      action: 'RESEARCH_MEMO_GENERATED',
      target: `ResearchMemo:${memo.id}`,
      afterState: { memoId: memo.id, clientId, topic, generatedBy },
      metadata: {
        client: client.name,
        topic,
        generatedBy,
        dataQuality: hasAdequateData ? 'ADEQUATE' : 'INSUFFICIENT',
      },
      aiInvolved: generatedBy === 'AI_DRAFT',
      severity: 'INFO',
    })

    return memo
  }
}
