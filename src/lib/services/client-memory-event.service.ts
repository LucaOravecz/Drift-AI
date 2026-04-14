import prisma from "@/lib/db"

type MemoryEventInput = {
  organizationId: string
  clientId: string
  sourceType: string
  sourceId?: string | null
  eventType: string
  title: string
  summary: string
  importance?: number
  evidence?: unknown
  payload?: unknown
  externalKey?: string | null
  recordedAt?: Date
}

function summarizeText(value: string | null | undefined, max = 180) {
  if (!value) return null
  const compact = value.replace(/\s+/g, " ").trim()
  if (compact.length <= max) return compact
  return `${compact.slice(0, max - 1)}...`
}

function parseStoredJson<T>(value: unknown): T | null {
  if (value == null) return null
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }
  if (typeof value === "object") return value as T
  return null
}

export class ClientMemoryEventService {
  static async recordEvent(input: MemoryEventInput) {
    const data = {
      organizationId: input.organizationId,
      clientId: input.clientId,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      eventType: input.eventType,
      title: input.title,
      summary: input.summary,
      importance: input.importance ?? 50,
      evidence: input.evidence as any,
      payload: input.payload as any,
      externalKey: input.externalKey ?? null,
      recordedAt: input.recordedAt ?? new Date(),
    }

    if (input.externalKey) {
      return prisma.clientMemoryEvent.upsert({
        where: { externalKey: input.externalKey },
        create: data,
        update: {
          title: data.title,
          summary: data.summary,
          importance: data.importance,
          evidence: data.evidence,
          payload: data.payload,
          recordedAt: data.recordedAt,
        },
      })
    }

    return prisma.clientMemoryEvent.create({ data })
  }

  static async listRecentEvents(clientId: string, days = 120) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    return prisma.clientMemoryEvent.findMany({
      where: { clientId, recordedAt: { gte: since } },
      orderBy: [{ importance: "desc" }, { recordedAt: "desc" }],
    })
  }

  static async syncClientSourceEvents(clientId: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        meetings: { orderBy: { scheduledAt: "desc" }, take: 12 },
        communications: { orderBy: { timestamp: "desc" }, take: 24 },
        documents: { orderBy: { uploadedAt: "desc" }, take: 12 },
        events: { orderBy: { createdAt: "desc" }, take: 12 },
        memorySnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    })

    if (!client) throw new Error(`Client not found: ${clientId}`)

    const ops: Promise<unknown>[] = []

    for (const communication of client.communications) {
      const title = communication.subject || `${communication.direction} ${communication.type.toLowerCase()}`
      ops.push(
        this.recordEvent({
          organizationId: client.organizationId,
          clientId,
          sourceType: "COMMUNICATION",
          sourceId: communication.id,
          eventType: "COMMUNICATION_CAPTURED",
          title,
          summary:
            summarizeText(communication.body) ||
            `Recorded ${communication.direction.toLowerCase()} ${communication.type.toLowerCase()} communication.`,
          importance: communication.direction === "INBOUND" ? 72 : 58,
          evidence: {
            direction: communication.direction,
            type: communication.type,
            status: communication.status,
          },
          externalKey: `communication:${communication.id}:captured`,
          recordedAt: communication.timestamp,
        })
      )
    }

    for (const meeting of client.meetings) {
      ops.push(
        this.recordEvent({
          organizationId: client.organizationId,
          clientId,
          sourceType: "MEETING",
          sourceId: meeting.id,
          eventType: "MEETING_CAPTURED",
          title: meeting.title,
          summary:
            summarizeText(meeting.notes) ||
            `${meeting.status === "COMPLETED" ? "Completed" : "Scheduled"} ${meeting.type.toLowerCase()} meeting recorded.`,
          importance: meeting.status === "COMPLETED" ? 74 : 60,
          evidence: {
            status: meeting.status,
            type: meeting.type,
            scheduledAt: meeting.scheduledAt,
            briefGenerated: meeting.briefGenerated,
          },
          externalKey: `meeting:${meeting.id}:captured`,
          recordedAt: meeting.scheduledAt,
        })
      )
    }

    for (const document of client.documents) {
      ops.push(
        this.recordEvent({
          organizationId: client.organizationId,
          clientId,
          sourceType: "DOCUMENT",
          sourceId: document.id,
          eventType: "DOCUMENT_CAPTURED",
          title: document.fileName,
          summary:
            summarizeText(document.summaryText) ||
            `Document ${document.fileName} uploaded${document.documentType ? ` (${document.documentType})` : ""}.`,
          importance: 54,
          evidence: {
            documentType: document.documentType,
            status: document.status,
            uploadedAt: document.uploadedAt,
          },
          externalKey: `document:${document.id}:captured`,
          recordedAt: document.uploadedAt,
        })
      )
    }

    for (const event of client.events) {
      ops.push(
        this.recordEvent({
          organizationId: client.organizationId,
          clientId,
          sourceType: "LIFE_EVENT",
          sourceId: event.id,
          eventType: "LIFE_EVENT_CAPTURED",
          title: event.title,
          summary: event.implications || `${event.title}${event.type ? ` (${event.type})` : ""} was added to the household timeline.`,
          importance: 82,
          evidence: {
            type: event.type,
            opportunity: event.opportunity,
            anniversaryTracked: event.isAnniversaryEvent,
          },
          externalKey: `life-event:${event.id}:captured`,
          recordedAt: event.createdAt,
        })
      )
    }

    const latestSnapshot = client.memorySnapshots[0]
    const payload = parseStoredJson<any>(latestSnapshot?.payload)
    if (latestSnapshot && payload?.clientDna) {
      ops.push(
        this.recordEvent({
          organizationId: client.organizationId,
          clientId,
          sourceType: "SNAPSHOT",
          sourceId: latestSnapshot.id,
          eventType: "CLIENT_DNA_REFRESHED",
          title: "Client DNA refreshed",
          summary: payload.clientDna.executiveSummary || latestSnapshot.summary,
          importance: 88,
          evidence: {
            dataQuality: latestSnapshot.dataQuality,
            profileVersion: latestSnapshot.profileVersion,
          },
          payload: {
            risk: payload.clientDna.risk,
            interactionPatterns: payload.clientDna.interactionPatterns,
          },
          externalKey: `snapshot:${latestSnapshot.id}:client-dna`,
          recordedAt: latestSnapshot.createdAt,
        })
      )
    }

    await Promise.all(ops)
  }
}
