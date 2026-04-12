import prisma from '../db'
import { callClaude } from './ai.service'
import { SecurityContext, SecurityService } from './security.service'
import { ClientMemoryService } from './client-memory.service'
import { detectClientOpportunities } from '../engines/opportunity.engine'
import { AuditService } from './audit.service'
import { IntegrationService } from './integration.service'

export class CommunicationService {
  private static async resolveOrgId(ctx?: SecurityContext | null): Promise<string> {
    if (ctx) return ctx.organizationId
    const org = await prisma.organization.findFirst()
    return org?.id ?? ''
  }

  static async getCommunications(ctx?: SecurityContext | null) {
    const orgId = await CommunicationService.resolveOrgId(ctx)
    return prisma.communication.findMany({
      where: { client: { organizationId: orgId } },
      include: { client: true },
      orderBy: { timestamp: 'desc' },
    })
  }

  static async getPendingApprovals(ctx?: SecurityContext | null) {
    const orgId = await CommunicationService.resolveOrgId(ctx)
    return prisma.communication.findMany({
      where: { status: 'PENDING_APPROVAL', client: { organizationId: orgId } },
      include: { client: true },
      orderBy: { timestamp: 'desc' },
    })
  }

  static async getRelationshipEvents(ctx?: SecurityContext | null) {
    const orgId = await CommunicationService.resolveOrgId(ctx)
    return prisma.relationshipEvent.findMany({
      where: { client: { organizationId: orgId } },
      include: { client: true },
      orderBy: [{ status: 'asc' }, { eventDate: 'asc' }],
    })
  }

  static async getStats(ctx?: SecurityContext | null) {
    const orgId = await CommunicationService.resolveOrgId(ctx)
    const where = { client: { organizationId: orgId } }
    const [total, pending, sent, drafts] = await Promise.all([
      prisma.communication.count({ where }),
      prisma.communication.count({ where: { ...where, status: 'PENDING_APPROVAL' } }),
      prisma.communication.count({ where: { ...where, status: 'SENT' } }),
      prisma.communication.count({ where: { ...where, status: 'DRAFT' } }),
    ])
    const relationshipEvents = await prisma.relationshipEvent.count({
      where: { ...where, status: 'PENDING' },
    })
    return { total, pending, sent, drafts, relationshipEventsPending: relationshipEvents }
  }

  /**
   * Generates a communication draft grounded in real client data.
   *
   * Rules:
   * 1. Advisor name comes from the DB (userId from SecurityContext) — not hardcoded
   * 2. AI prompt explicitly forbids inventing facts not present in stored data
   * 3. If AI fails, the draft is clearly labeled as a template requiring completion
   * 4. Subject line is generated based on actual trigger, not a generic template
   * 5. Draft is stored with metadata showing what trigger sourced it
   */
  static async generateDraft(clientId: string, type: string, ctx: SecurityContext, topic?: string) {
    await SecurityService.enforceAccess(ctx, 'AI_GENERATION', 'CommunicationDraftGen')

    const client = await prisma.client.findUnique({
      where: {
        id: clientId,
        organizationId: ctx.organizationId,
      },
    })
    if (!client) throw new Error('Client not found or access denied.')

    await SecurityService.enforceAccess(ctx, 'FINANCIAL_PII_VIEW', `PII_ACCESS:${clientId}`)

    // Get real advisor name from DB — not hardcoded
    const advisor = await prisma.user.findUnique({ where: { id: ctx.userId } })
    const advisorName = advisor?.name ?? 'Your Advisor'
    const latestSnapshot = await ClientMemoryService.getLatestSnapshot(clientId)
    const refreshedSnapshot = latestSnapshot
      ? null
      : await ClientMemoryService.refreshSnapshot(clientId).then((result) => ({
          ...result.snapshot,
          payload: result.profile,
          missingData: result.profile.missingData,
        }))
    const memoryResult = latestSnapshot ?? refreshedSnapshot
    if (!memoryResult) {
      throw new Error("Unable to load client memory snapshot.")
    }
    const memoryProfile = memoryResult.payload
    const deterministicSignals = await detectClientOpportunities(clientId)
    const taxInsights = await prisma.taxInsight.findMany({
      where: { clientId, status: 'UNDER_REVIEW' },
      take: 3,
      orderBy: { createdAt: 'desc' },
    })
    const openTasks = await prisma.task.findMany({
      where: { clientId, isCompleted: false },
      take: 5,
      orderBy: { dueDate: 'asc' },
    })
    const firstName = client.name.split(' ')[0]

    let subject = ''
    let body = ''
    let generationMethod: 'AI_DRAFT' | 'TEMPLATE_FALLBACK' = 'TEMPLATE_FALLBACK'

    try {
      const systemPrompt = `You are a financial advisor writing a professional email to a client.

STRICT RULES — you MUST follow these:
1. Only reference facts that are explicitly provided in the client data below
2. Do NOT invent portfolio performance numbers, market events, or financial outcomes
3. Do NOT reference specific dollar amounts unless they are in the provided data
4. Do NOT claim to have "noticed" things that are not in the data
5. Write in a professional, direct tone — no marketing language or hype
6. If there is not enough data to write a meaningful email, write a brief, honest message
7. The email must be something a real advisor could actually send to a real client
8. Never start with "I hope you're well" or similar filler phrases`

      const typeContext: Record<string, string> = {
        CHECK_IN: 'A professional check-in to reconnect and offer assistance',
        TAX_OPPORTUNITY: 'A note about a tax-related item that requires discussion — only reference tax items that appear in the client data below',
        MEETING_CONFIRMATION: 'A brief meeting confirmation with the key topics from the client record',
        MILESTONE: 'A professional acknowledgment of a recorded life event',
      }

      const contextText = typeContext[type] ?? `A professional ${type.toLowerCase().replace(/_/g, ' ')} communication`

      // Build a data summary using only fields that have values
      const dataSummary = [
        `Client: ${client.name}`,
        client.riskProfile ? `Risk Profile: ${client.riskProfile}` : null,
        memoryProfile.knownFacts.goals.value !== 'Not recorded' ? `Stated Goals: ${memoryProfile.knownFacts.goals.value}` : null,
        memoryProfile.knownFacts.concerns.value !== 'Not recorded' ? `Known Concerns: ${memoryProfile.knownFacts.concerns.value}` : null,
        memoryProfile.knownFacts.communicationPreferences.value !== 'Not recorded'
          ? `Communication Preferences: ${memoryProfile.knownFacts.communicationPreferences.value}`
          : null,
        deterministicSignals.length > 0 ? `Deterministic Signals: ${deterministicSignals.map((signal) => signal.title).join(', ')}` : null,
        taxInsights.length > 0 ? `Open Tax Items: ${taxInsights.map((tax) => tax.title).join(', ')}` : null,
        openTasks.length > 0 ? `Open Tasks: ${openTasks.map((task) => task.title).join(', ')}` : null,
        memoryProfile.missingData.length > 0 ? `Missing Data: ${memoryProfile.missingData.join(', ')}` : null,
        topic ? `Specific topic for this message: ${topic}` : null,
      ].filter(Boolean).join('\n')

      const userMessage = `Write a professional advisor email.
Type: ${contextText}
Available client data:
${dataSummary}

Advisor signing: ${advisorName}
Client first name: ${firstName}

Return a JSON object: { "subject": "...", "body": "..." }
The body should be 2-4 short paragraphs. Professional, direct, no filler.`

      const result = await callClaude(systemPrompt, userMessage, 1024)

      // Extract JSON from response
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { subject: string; body: string }
        subject = parsed.subject
        body = parsed.body
        generationMethod = 'AI_DRAFT'
      } else {
        throw new Error('AI did not return valid JSON')
      }
    } catch (err) {
      console.warn('[CommunicationService] AI unavailable, using honest template:', err)

      // Honest fallback — clearly a template that requires completion
      const typeLabel = type.replace(/_/g, ' ').toLowerCase()
      subject = topic
        ? `Re: ${topic} — ${firstName}`
        : `Follow-up — ${firstName}`

      body = `Hi ${firstName},

[Insufficient stored data for a tailored draft — please complete before sending]

I wanted to reach out regarding ${topic ?? typeLabel}. Please let me know a convenient time to connect.

Best regards,
${advisorName}

---
Note: This draft was generated as a template because the communication generation service was unavailable. The content above requires review and completion before sending.`
    }

    const comm = await prisma.communication.create({
      data: {
        clientId,
        type: 'EMAIL',
        direction: 'OUTBOUND',
        subject,
        body,
        status: 'PENDING_APPROVAL',
        approvalComments: JSON.stringify({
          generationMethod,
          deterministicInputs: {
            memorySnapshotId: memoryResult.id,
            deterministicSignals: deterministicSignals.map((signal) => signal.title),
            taxInsights: taxInsights.map((tax) => tax.title),
            openTasks: openTasks.map((task) => task.title),
            missingData: memoryProfile.missingData,
          },
        }),
      },
    })

    await AuditService.logAction({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'COMMUNICATION_DRAFT_GENERATED',
      target: `Client:${clientId}`,
      details: `${generationMethod === 'AI_DRAFT' ? 'AI-assisted' : 'Template fallback'} draft created for ${client.name}. Type: ${type}.`,
      metadata: {
        communicationId: comm.id,
        memorySnapshotId: memoryResult.id,
        deterministicSignals: deterministicSignals.map((signal) => signal.title),
        taxInsights: taxInsights.map((tax) => tax.title),
        openTasks: openTasks.map((task) => task.title),
        missingData: memoryProfile.missingData,
      },
      aiInvolved: generationMethod === 'AI_DRAFT',
      severity: 'INFO',
    })

    await prisma.notification.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        type: 'COMMUNICATION',
        title: 'Outreach draft generated',
        body: `A ${generationMethod === 'AI_DRAFT' ? 'grounded AI-assisted' : 'fallback'} draft for ${client.name} is pending approval.`,
        link: '/communications',
      },
    })

    // Compliance flag
    await prisma.complianceFlag.create({
      data: {
        organizationId: ctx.organizationId,
        type: 'UNREVIEWED_DRAFT',
        severity: 'LOW',
        description: `New ${generationMethod === 'AI_DRAFT' ? 'AI-drafted' : 'template'} communication for ${client.name} requires advisor review before sending.`,
        target: `Communication:${comm.id}`,
        targetId: comm.id,
        aiInvolved: generationMethod === 'AI_DRAFT',
        status: 'OPEN',
      },
    })

    return comm
  }

  static async sendEmail(commId: string, ctx: SecurityContext): Promise<void> {
    await SecurityService.enforceAccess(ctx, 'COMMUNICATION_SEND', 'FinalSendAction')

    const comm = await prisma.communication.findUnique({
      where: {
        id: commId,
        client: { organizationId: ctx.organizationId },
      },
      include: { client: true },
    })

    if (!comm) throw new Error('Communication not found or tenant mismatch.')
    if (comm.status !== 'APPROVED') throw new Error('Cannot send unapproved communication.')

    if (!comm.client.email) {
      await AuditService.logAction({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'COMMUNICATION_SEND_BLOCKED',
        target: `Communication:${commId}`,
        details: `Client ${comm.client.name} does not have an email address on file.`,
        severity: 'WARNING',
      })
      throw new Error('Cannot send communication: client email is missing.')
    }

    await IntegrationService.deliverEmail({
      communicationId: commId,
      to: comm.client.email,
      subject: comm.subject,
      body: comm.body,
      clientName: comm.client.name,
      advisorUserId: ctx.userId,
      organizationId: ctx.organizationId,
    }, ctx)

    const updated = await prisma.communication.update({
      where: { id: commId },
      data: { status: 'SENT', sentAt: new Date() },
    })

    await AuditService.logAction({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'COMMUNICATION_SENT',
      target: `Communication:${commId}`,
      details: `Communication sent to ${comm.client.name}.`,
      afterState: updated,
      severity: 'INFO',
    })

    await prisma.notification.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        type: 'COMMUNICATION',
        title: 'Communication sent',
        body: `An approved communication to ${comm.client.name} was marked sent.`,
        link: '/communications',
      },
    })
  }
}
