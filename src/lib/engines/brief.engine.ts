/**
 * Brief Engine — Grounded Meeting Brief Assembly
 *
 * Produces a meeting brief from ONLY what is stored in the database.
 * Every section either contains real data or is clearly marked as missing/unavailable.
 *
 * Rules:
 * - NO section is fabricated
 * - Missing data → explicit "not available" message, not an invented placeholder
 * - AI layer (if enabled) only ORGANIZES and LABELS what the deterministic layer found
 * - AI is NOT allowed to add facts not present in the input data
 */

import prisma from "../db"
import { buildClientMemoryProfile } from "./client-memory.engine"
import { detectClientOpportunities } from "./opportunity.engine"
import { daysSince } from "./grounded-output"

export interface BriefSection {
  title: string
  available: boolean
  content: string | string[] | null
  source: string        // What DB records this came from
  note?: string         // Any caveats about completeness
  missingData?: string[]
  evidenceRecords?: string[]
}

export interface GroundedBrief {
  generatedAt: string
  generatedBy: "DETERMINISTIC" | "AI_ASSISTED" | "INSUFFICIENT_DATA"
  meetingTitle: string
  clientName: string
  dataQuality: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT"
  sections: BriefSection[]
  disclaimer: string
  missingData: string[]
}

export async function buildGroundedBrief(meetingId: string): Promise<GroundedBrief> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      client: {
        include: {
          intelligence: true,
          meetings: { orderBy: { scheduledAt: "desc" }, take: 5 },
          communications: { orderBy: { timestamp: "desc" }, take: 10 },
          tasks: { where: { isCompleted: false }, orderBy: { priority: "desc" } },
          events: { orderBy: { createdAt: "desc" }, take: 5 },
          opportunities: { where: { status: { in: ["DRAFT", "PENDING_REVIEW"] } } },
          taxInsights: { where: { status: "UNDER_REVIEW" } },
          investInsights: { where: { status: "UNDER_REVIEW" } },
          documents: { orderBy: { uploadedAt: "desc" }, take: 5 },
        },
      },
    },
  })

  if (!meeting) throw new Error(`Meeting not found: ${meetingId}`)

  const client = meeting.client
  const intel = client.intelligence
  const sections: BriefSection[] = []
  const missing: string[] = []

  // ── Section 1: Client Snapshot (always available) ──────────────────────
  const aumDisplay = client.aum
    ? `$${(client.aum / 1_000_000).toFixed(1)}M`
    : null

  sections.push({
    title: "Client Snapshot",
    available: true,
    source: "clients, intelligenceProfiles",
    content: [
      `Name: ${client.name}`,
      `Type: ${client.type}`,
      `AUM: ${aumDisplay ?? "Not on file"}`,
      `Risk Profile: ${client.riskProfile ?? "Not on file"}`,
      `Life Stage: ${intel?.lifeStage ?? "Not recorded"}`,
      `Relationship Strength: ${intel?.relationStrength ?? "N/A"}/100`,
      `Sentiment Score: ${intel?.sentimentScore ?? "N/A"}/100`,
      `Churn Score: ${client.churnScore}/100`,
    ],
    note: !aumDisplay || !client.riskProfile ? "Some fields are missing — profile is incomplete" : undefined,
  })

  if (!aumDisplay) missing.push("AUM (clients.aum)")
  if (!client.riskProfile) missing.push("Risk profile (clients.riskProfile)")

  // ── Section 2: What Changed Since Last Meeting ──────────────────────────
  const lastCompletedMeeting = client.meetings
    .filter(m => m.id !== meetingId && m.status === "COMPLETED")
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())[0]

  if (lastCompletedMeeting) {
    const sinceLastMeeting = new Date(lastCompletedMeeting.scheduledAt)
    const changesAfterLastMeeting: string[] = []

    // Events since last meeting
    const newEvents = client.events.filter(e => new Date(e.createdAt) > sinceLastMeeting)
    newEvents.forEach(e => changesAfterLastMeeting.push(`Life event recorded: ${e.title}${e.implications ? ` — ${e.implications}` : ""}`))

    // New tasks since last meeting
    const newTasks = client.tasks.filter(_t => false) // tasks don't have createdAt in schema — skip
    if (newTasks.length > 0) changesAfterLastMeeting.push(`${newTasks.length} new task(s) since last meeting`)

    // Recent communications
    const recentComms = client.communications.filter(c => new Date(c.timestamp) > sinceLastMeeting)
    if (recentComms.length > 0) {
      changesAfterLastMeeting.push(`${recentComms.length} communication(s) since last meeting`)
    }

    sections.push({
      title: "What Changed Since Last Meeting",
      available: true,
      source: `meetings:${lastCompletedMeeting.id}, lifeEvents, tasks, communications`,
      content: changesAfterLastMeeting.length > 0
        ? changesAfterLastMeeting
        : ["No recorded changes since last meeting"],
      note: `Last completed meeting: ${new Date(lastCompletedMeeting.scheduledAt).toLocaleDateString()}`,
    })
  } else {
    sections.push({
      title: "What Changed Since Last Meeting",
      available: false,
      source: "meetings",
      content: null,
      note: "No previous completed meetings on record — this appears to be the first review",
    })
  }

  // ── Section 3: Known Goals & Concerns ──────────────────────────────────
  if (intel?.goals || intel?.concerns) {
    sections.push({
      title: "Stated Goals & Concerns",
      available: true,
      source: "intelligenceProfiles.goals, intelligenceProfiles.concerns",
      content: [
        intel?.goals ? `Goals: ${intel.goals}` : "Goals: Not recorded",
        intel?.concerns ? `Concerns: ${intel.concerns}` : "Concerns: Not recorded",
      ],
    })
  } else {
    sections.push({
      title: "Stated Goals & Concerns",
      available: false,
      source: "intelligenceProfiles",
      content: null,
      note: "No goals or concerns recorded in the intelligence profile",
    })
    missing.push("Client goals (intelligenceProfiles.goals)")
    missing.push("Client concerns (intelligenceProfiles.concerns)")
  }

  // ── Section 4: Open Opportunities ──────────────────────────────────────
  if (client.opportunities.length > 0) {
    sections.push({
      title: "Open Opportunities",
      available: true,
      source: `opportunities (${client.opportunities.map(o => o.id).join(", ")})`,
      content: client.opportunities.map(o =>
        `[${o.type.replace(/_/g, " ")}] ${o.description} — ${o.suggestedAction}`
      ),
    })
  } else {
    sections.push({
      title: "Open Opportunities",
      available: false,
      source: "opportunities",
      content: null,
      note: "No open opportunities recorded",
    })
  }

  // ── Section 5: Tax Items Under Review ──────────────────────────────────
  if (client.taxInsights.length > 0) {
    sections.push({
      title: "Tax Items Under Review",
      available: true,
      source: `taxInsights (${client.taxInsights.map(t => t.id).join(", ")})`,
      content: client.taxInsights.map(t =>
        `[${t.urgency}] ${t.title} — ${t.suggestedAction}`
      ),
      note: "Draft observations only — CPA/advisor review required before any action",
    })
  } else {
    sections.push({
      title: "Tax Items",
      available: false,
      source: "taxInsights",
      content: null,
      note: "No tax insights recorded for this client",
    })
  }

  // ── Section 6: Investment Review Items ─────────────────────────────────
  if (client.investInsights.length > 0) {
    sections.push({
      title: "Investment Review Items",
      available: true,
      source: `investmentInsights (${client.investInsights.map(i => i.id).join(", ")})`,
      content: client.investInsights.map(i =>
        `${i.title}${i.assetTicker ? ` (${i.assetTicker})` : ""} — ${i.thesis}`
      ),
      note: "Research assistance only — not a trade recommendation",
    })
  } else {
    sections.push({
      title: "Investment Review Items",
      available: false,
      source: "investmentInsights",
      content: null,
      note: "No investment insights recorded",
    })
  }

  // ── Section 7: Open Tasks & Follow-Ups ─────────────────────────────────
  if (client.tasks.length > 0) {
    const overdue = client.tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date())
    sections.push({
      title: "Open Tasks & Follow-Ups",
      available: true,
      source: `tasks (${client.tasks.map(t => t.id).join(", ")})`,
      content: client.tasks.map(t =>
        `[${t.priority}${t.dueDate && new Date(t.dueDate) < new Date() ? " — OVERDUE" : ""}] ${t.title}${t.dueDate ? ` — due ${new Date(t.dueDate).toLocaleDateString()}` : ""}`
      ),
      note: overdue.length > 0 ? `${overdue.length} task(s) are overdue` : undefined,
    })
  } else {
    sections.push({
      title: "Open Tasks & Follow-Ups",
      available: false,
      source: "tasks",
      content: null,
      note: "No open tasks on record",
    })
  }

  // ── Section 8: Life Events ──────────────────────────────────────────────
  if (client.events.length > 0) {
    sections.push({
      title: "Recorded Life Events",
      available: true,
      source: `lifeEvents (${client.events.map(e => e.id).join(", ")})`,
      content: client.events.map(e =>
        `${e.title}${e.type ? ` [${e.type}]` : ""}${e.implications ? ` — ${e.implications}` : ""}${e.opportunity ? ` — Opportunity: ${e.opportunity}` : ""}`
      ),
    })
  }

  // ── Section 9: Communication Preferences ──────────────────────────────
  if (intel?.communication) {
    sections.push({
      title: "Communication Preferences",
      available: true,
      source: "intelligenceProfiles.communication",
      content: intel.communication,
    })
  }

  // ── Section 10: Detected Opportunities (Deterministic Rules) ───────────
  const detectedOpps = await detectClientOpportunities(client.id)
  const newDetected = detectedOpps.filter(o => o.confidence !== "LOW")
  if (newDetected.length > 0) {
    sections.push({
      title: "System-Detected Signals",
      available: true,
      source: "opportunity.engine (rule-based)",
      content: newDetected.map(o =>
        `[${o.urgency}] ${o.title} — ${o.suggestedAction}`
      ),
      note: "Generated by deterministic rule engine, not AI inference",
    })
  }

  const availableSections = sections.filter(s => s.available)
  let dataQuality: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT" = "HIGH"
  if (availableSections.length <= 2) dataQuality = "INSUFFICIENT"
  else if (availableSections.length <= 4) dataQuality = "LOW"
  else if (availableSections.length <= 6) dataQuality = "MEDIUM"

  return {
    generatedAt: new Date().toISOString(),
    generatedBy: "DETERMINISTIC",
    meetingTitle: meeting.title,
    clientName: client.name,
    dataQuality,
    sections,
    disclaimer:
      "This brief is assembled from stored database records only. No facts are inferred or invented. Sections marked 'Not available' mean the data is missing from the database — not that the situation doesn't apply.",
    missingData: missing,
  }
}

// Get clientId from meetingId
async function getClientIdFromMeeting(meetingId: string): Promise<string> {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } })
  if (!meeting) throw new Error(`Meeting not found: ${meetingId}`)
  return meeting.clientId
}

const clientIdFromMeetingId = getClientIdFromMeeting
export { clientIdFromMeetingId }
