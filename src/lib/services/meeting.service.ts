import prisma from '../db'
import { buildGroundedBrief } from '../engines/brief.engine'
import { callClaudeJSON } from './ai.service'
import { AuditService } from './audit.service'

export class MeetingService {
  static async getMeetings() {
    return prisma.meeting.findMany({
      include: { client: true },
      orderBy: { scheduledAt: 'asc' },
    })
  }

  static async getUpcoming() {
    return prisma.meeting.findMany({
      where: {
        scheduledAt: { gte: new Date() },
        status: 'SCHEDULED',
      },
      include: { client: true },
      orderBy: { scheduledAt: 'asc' },
    })
  }

  static async getMeetingWithBrief(id: string) {
    return prisma.meeting.findUnique({
      where: { id },
      include: { client: true },
    })
  }

  /**
   * Generates a meeting brief in two layers:
   *
   * Layer 1 (DETERMINISTIC): Build a grounded brief from stored DB records only.
   *   - Only includes sections where data exists
   *   - Every claim is tagged with its source record
   *   - Missing data is explicitly listed, not hidden or filled
   *
   * Layer 2 (AI OPTIONAL): If AI is available, use it ONLY to:
   *   - Write polished talking points based on the deterministic findings
   *   - Suggest follow-up questions based on the open items identified
   *   - The AI prompt strictly forbids adding facts not present in the input
   *
   * If AI fails: save the deterministic brief as-is. It is the ground truth.
   */
  static async generateBrief(meetingId: string): Promise<string> {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { client: true },
    })
    if (!meeting) throw new Error('Meeting not found')

    // STEP 1: Build grounded brief (always succeeds — deterministic)
    const groundedBrief = await buildGroundedBrief(meetingId)

    // STEP 2: Attempt AI enhancement of talking points only
    let aiTalkingPoints: string[] | null = null
    let aiFollowUpQuestions: string[] | null = null
    let briefGeneratedBy: 'DETERMINISTIC' | 'AI_ASSISTED' = 'DETERMINISTIC'

    const systemPrompt = `You are a meeting preparation assistant for a financial advisor.

STRICT RULES — you MUST follow these exactly:
1. You may ONLY reference facts that are explicitly provided in the data below
2. You may NOT invent, infer, or assume any financial details not in the input
3. You may NOT add claims about portfolio performance, market conditions, or specific dollar amounts unless they are in the input data
4. If a section has "Not available" or "Not recorded" — do NOT fill it in
5. Do NOT use phrases like "elite", "institutional-grade", "alpha", or similar marketing language
6. Talking points must be grounded questions or discussion prompts, not unsupported conclusions
7. If insufficient data exists to write meaningful talking points, return an empty array

Your role: given the available data, write 3-5 practical discussion prompts for the advisor.`

    const availableSections = groundedBrief.sections.filter(s => s.available)

    if (availableSections.length >= 3) {
      try {
        const userMessage = `Write meeting talking points for: "${meeting.title}" with ${meeting.client.name}.

Available data for this brief:
${availableSections.map(s => `${s.title}:\n${Array.isArray(s.content) ? s.content.join('\n') : s.content}`).join('\n\n')}

Return JSON: { "talkingPoints": ["point 1", "point 2", ...], "suggestedQuestions": ["q1", "q2", ...] }

IMPORTANT: Only reference facts listed above. Do not add any information not present here.`

        const result = await callClaudeJSON<{ talkingPoints: string[]; suggestedQuestions: string[] }>(
          systemPrompt,
          userMessage,
          { maxTokens: 2048, organizationId: meeting.client.organizationId }
        )
        aiTalkingPoints = result.talkingPoints?.slice(0, 5) ?? null
        aiFollowUpQuestions = result.suggestedQuestions?.slice(0, 5) ?? null
        briefGeneratedBy = 'AI_ASSISTED'
      } catch (err) {
        console.warn('[MeetingService] AI enhancement unavailable, using deterministic brief only:', err)
        // Fallback is fine — deterministic brief is the real output
      }
    }

    // STEP 3: Serialize to stored format
    const briefData = {
      generatedAt: new Date().toISOString(),
      generatedBy: briefGeneratedBy,
      dataQuality: groundedBrief.dataQuality,
      meetingTitle: groundedBrief.meetingTitle,
      clientName: groundedBrief.clientName,
      disclaimer: groundedBrief.disclaimer,
      missingData: groundedBrief.missingData,

      // Deterministic sections — always present
      snapshot: {
        name: meeting.client.name,
        type: meeting.client.type,
        aum: meeting.client.aum ? `$${(meeting.client.aum / 1_000_000).toFixed(1)}M` : 'Not on file',
        riskProfile: meeting.client.riskProfile ?? 'Not on file',
      },

      sections: groundedBrief.sections.map(s => ({
        title: s.title,
        available: s.available,
        content: s.available ? s.content : null,
        source: s.source,
        note: s.note,
        missingData: s.missingData,
      })),

      // AI-generated additions (clearly labeled as AI)
      ...(aiTalkingPoints && aiTalkingPoints.length > 0
        ? {
            aiTalkingPoints: {
              label: 'AI-suggested talking points — based only on data above — requires advisor review',
              items: aiTalkingPoints,
            },
          }
        : {}),

      ...(aiFollowUpQuestions && aiFollowUpQuestions.length > 0
        ? {
            aiFollowUpQuestions: {
              label: 'AI-suggested follow-up questions — based only on data above',
              items: aiFollowUpQuestions,
            },
          }
        : {}),
    }

    const briefText = JSON.stringify(briefData)

    await prisma.meeting.update({
      where: { id: meetingId },
      data: { briefGenerated: true, briefText },
    })

    await AuditService.logAction({
      organizationId: meeting.client.organizationId,
      action: "MEETING_BRIEF_GENERATED",
      target: `Meeting:${meetingId}`,
      details: `Meeting brief saved for ${meeting.title}. Generated by ${briefGeneratedBy}.`,
      metadata: {
        generatedBy: briefGeneratedBy,
        missingData: groundedBrief.missingData,
        dataQuality: groundedBrief.dataQuality,
      },
      aiInvolved: briefGeneratedBy === "AI_ASSISTED",
      severity: "INFO",
    })

    await prisma.notification.create({
      data: {
        organizationId: meeting.client.organizationId,
        type: "MEETING",
        title: "Meeting brief updated",
        body: `A ${briefGeneratedBy === "AI_ASSISTED" ? "deterministic + AI-assisted" : "deterministic"} brief was saved for ${meeting.title}.`,
        link: "/meetings",
      },
    }).catch(() => null)

    return briefText
  }
}
