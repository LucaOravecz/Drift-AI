import prisma from '../db'
import { AuditService } from './audit.service'
import { MeetingPrepService } from './meeting-prep.service'

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
   * Generates a meeting brief via the explicit multi-step meeting-prep pipeline.
   */
  static async generateBrief(meetingId: string): Promise<string> {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { client: true },
    })
    if (!meeting) throw new Error('Meeting not found')
    const briefData = await MeetingPrepService.generateMeetingBrief(meetingId)
    const briefText = JSON.stringify(briefData)

    await AuditService.logAction({
      organizationId: meeting.client.organizationId,
      action: "MEETING_BRIEF_GENERATED",
      target: `Meeting:${meetingId}`,
      details: `Meeting brief saved for ${meeting.title} via the meeting-prep pipeline.`,
      metadata: briefData,
      aiInvolved: true,
      severity: "INFO",
    })

    await prisma.notification.create({
      data: {
        organizationId: meeting.client.organizationId,
        type: "MEETING",
        title: "Meeting brief updated",
        body: `A source-grounded meeting brief was saved for ${meeting.title}.`,
        link: "/meetings",
      },
    }).catch(() => null)

    return briefText
  }
}
