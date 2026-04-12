/**
 * Client Memory Engine
 *
 * Deterministic layer that extracts verifiable facts from stored client records.
 * NOTHING is invented here — every field maps to a specific DB column or computable value.
 *
 * Rules:
 * - StoredField: value read directly from DB column
 * - Computed: math/date calc on stored values
 * - No AI inference, no keyword guessing, no fabricated narratives
 */

import prisma from "../db"
import { GroundedClaim, GroundedSection, GroundedOutput, daysSince, formatAum, DataConfidence } from "./grounded-output"

export interface ClientMemoryProfile {
  clientId: string
  clientName: string
  dataQuality: DataConfidence

  // --- Known Facts (directly from DB) ---
  knownFacts: {
    name: GroundedClaim
    type: GroundedClaim
    aum: GroundedClaim
    riskProfile: GroundedClaim
    email: GroundedClaim
    phone: GroundedClaim
    tags: GroundedClaim
    lastContact: GroundedClaim
    daysSinceContact: GroundedClaim
    lifeStage: GroundedClaim
    goals: GroundedClaim
    concerns: GroundedClaim
    communicationPreferences: GroundedClaim
    familyContext: GroundedClaim
  }

  // --- Activity Counts (computed) ---
  activityCounts: {
    totalMeetings: number
    completedMeetings: number
    scheduledMeetings: number
    openTasks: number
    overdueTasks: number
    totalDocuments: number
    processedDocuments: number
    openOpportunities: number
    taxInsightsUnderReview: number
    communicationsLast90Days: number
    recentLifeEvents: number
  }

  // --- Recent Activity (last 5 of each, sourced from DB) ---
  recentMeetings: { title: string; date: string; status: string; notes: string | null }[]
  recentCommunications: { direction: string; subject: string | null; date: string; type: string }[]
  openTasks: { title: string; priority: string; dueDate: string | null; source: string }[]
  lifeEvents: { title: string; type: string | null; implications: string | null }[]
  openOpportunities: { type: string; description: string; confidence: number; suggestedAction: string }[]
  taxInsights: { title: string; urgency: string; status: string; rationale: string }[]

  // --- Relationship Intelligence (directly from IntelligenceProfile) ---
  intelligence: {
    sentimentScore: number | null
    relationStrength: number | null
    churnScore: number
    lastUpdated: string | null
    source: "STORED" | "NOT_AVAILABLE"
  }

  // --- Sections for Brief/Display ---
  sections: GroundedSection[]

  // --- Missing Data ---
  missingData: string[]
  disclaimer: string
}

export async function buildClientMemoryProfile(clientId: string): Promise<ClientMemoryProfile> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      intelligence: true,
      meetings: { orderBy: { scheduledAt: "desc" }, take: 5 },
      communications: { orderBy: { timestamp: "desc" }, take: 20 },
      tasks: { where: { isCompleted: false }, orderBy: { dueDate: "asc" }, take: 10 },
      events: { orderBy: { createdAt: "desc" }, take: 5 },
      documents: { orderBy: { uploadedAt: "desc" }, take: 10 },
      opportunities: { where: { status: { in: ["DRAFT", "PENDING_REVIEW"] } }, take: 5 },
      taxInsights: { where: { status: "UNDER_REVIEW" }, take: 5 },
      relationshipEvents: { orderBy: { eventDate: "asc" }, take: 5 },
    },
  })

  if (!client) throw new Error(`Client not found: ${clientId}`)

  const intel = client.intelligence
  const now = Date.now()
  const daysSinceContact = daysSince(client.lastContactAt)
  const missing: string[] = []

  // Build Known Facts — each directly maps to a DB column
  const knownFacts = {
    name: {
      value: client.name,
      source: "STORED_FIELD" as const,
      confidence: "HIGH" as const,
      evidence: "clients.name",
    },
    type: {
      value: client.type,
      source: "STORED_FIELD" as const,
      confidence: "HIGH" as const,
      evidence: "clients.type",
    },
    aum: client.aum
      ? { value: formatAum(client.aum), source: "STORED_FIELD" as const, confidence: "HIGH" as const, evidence: `clients.aum = ${client.aum}` }
      : { value: "Not on file", source: "STORED_FIELD" as const, confidence: "INSUFFICIENT" as const, evidence: "clients.aum is null" },
    riskProfile: client.riskProfile
      ? { value: client.riskProfile, source: "STORED_FIELD" as const, confidence: "HIGH" as const, evidence: "clients.riskProfile" }
      : { value: "Not on file", source: "STORED_FIELD" as const, confidence: "INSUFFICIENT" as const, evidence: "clients.riskProfile is null" },
    email: client.email
      ? { value: client.email, source: "STORED_FIELD" as const, confidence: "HIGH" as const, evidence: "clients.email" }
      : { value: "Not on file", source: "STORED_FIELD" as const, confidence: "INSUFFICIENT" as const, evidence: "clients.email is null" },
    phone: client.phone
      ? { value: client.phone, source: "STORED_FIELD" as const, confidence: "HIGH" as const, evidence: "clients.phone" }
      : { value: "Not on file", source: "STORED_FIELD" as const, confidence: "INSUFFICIENT" as const, evidence: "clients.phone is null" },
    tags: client.tags
      ? { value: client.tags, source: "STORED_FIELD" as const, confidence: "HIGH" as const, evidence: "clients.tags" }
      : { value: "None", source: "STORED_FIELD" as const, confidence: "HIGH" as const, evidence: "clients.tags is null" },
    lastContact: client.lastContactAt
      ? { value: new Date(client.lastContactAt).toLocaleDateString(), source: "STORED_FIELD" as const, confidence: "HIGH" as const, evidence: "clients.lastContactAt" }
      : { value: "No contact recorded", source: "STORED_FIELD" as const, confidence: "INSUFFICIENT" as const, evidence: "clients.lastContactAt is null" },
    daysSinceContact: daysSinceContact !== null
      ? { value: `${daysSinceContact} days ago`, source: "COMPUTED" as const, confidence: "HIGH" as const, evidence: `Computed from clients.lastContactAt (${new Date(client.lastContactAt!).toLocaleDateString()})` }
      : { value: "Unknown", source: "COMPUTED" as const, confidence: "INSUFFICIENT" as const, evidence: "clients.lastContactAt is null" },
    lifeStage: intel?.lifeStage
      ? { value: intel.lifeStage, source: "STORED_FIELD" as const, confidence: "HIGH" as const, evidence: "intelligenceProfiles.lifeStage" }
      : { value: "Not recorded", source: "STORED_FIELD" as const, confidence: "INSUFFICIENT" as const, evidence: "intelligenceProfiles.lifeStage is null" },
    goals: intel?.goals
      ? { value: intel.goals, source: "STORED_FIELD" as const, confidence: "HIGH" as const, evidence: "intelligenceProfiles.goals" }
      : { value: "Not recorded", source: "STORED_FIELD" as const, confidence: "INSUFFICIENT" as const, evidence: "intelligenceProfiles.goals is null" },
    concerns: intel?.concerns
      ? { value: intel.concerns, source: "STORED_FIELD" as const, confidence: "HIGH" as const, evidence: "intelligenceProfiles.concerns" }
      : { value: "Not recorded", source: "STORED_FIELD" as const, confidence: "INSUFFICIENT" as const, evidence: "intelligenceProfiles.concerns is null" },
    communicationPreferences: intel?.communication
      ? { value: intel.communication, source: "STORED_FIELD" as const, confidence: "HIGH" as const, evidence: "intelligenceProfiles.communication" }
      : { value: "Not recorded", source: "STORED_FIELD" as const, confidence: "INSUFFICIENT" as const, evidence: "intelligenceProfiles.communication is null" },
    familyContext: intel?.familyContext
      ? { value: intel.familyContext, source: "STORED_FIELD" as const, confidence: "HIGH" as const, evidence: "intelligenceProfiles.familyContext" }
      : { value: "Not recorded", source: "STORED_FIELD" as const, confidence: "INSUFFICIENT" as const, evidence: "intelligenceProfiles.familyContext is null" },
  }

  // --- Activity Counts ---
  const completedMeetings = client.meetings.filter(m => m.status === "COMPLETED")
  const scheduledMeetings = client.meetings.filter(m => m.status === "SCHEDULED")
  const now90 = new Date(now - 90 * 86_400_000)
  const comms90 = client.communications.filter(c => new Date(c.timestamp) > now90)
  const overdueTasks = client.tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date())

  const activityCounts = {
    totalMeetings: client.meetings.length,
    completedMeetings: completedMeetings.length,
    scheduledMeetings: scheduledMeetings.length,
    openTasks: client.tasks.length,
    overdueTasks: overdueTasks.length,
    totalDocuments: client.documents.length,
    processedDocuments: client.documents.filter(d => d.status === "SUMMARIZED" || d.status === "REVIEWED").length,
    openOpportunities: client.opportunities.length,
    taxInsightsUnderReview: client.taxInsights.length,
    communicationsLast90Days: comms90.length,
    recentLifeEvents: client.events.length,
  }

  // --- Missing data detection ---
  if (!client.aum) missing.push("AUM / total assets under management")
  if (!client.riskProfile) missing.push("Risk profile")
  if (!intel?.goals) missing.push("Stated goals (intelligenceProfiles.goals)")
  if (!intel?.concerns) missing.push("Known concerns (intelligenceProfiles.concerns)")
  if (!intel?.lifeStage) missing.push("Life stage classification")
  if (!client.lastContactAt) missing.push("Last contact date")
  if (client.documents.length === 0) missing.push("Documents (no files uploaded)")
  if (client.meetings.length === 0) missing.push("Meeting history")
  if (client.communications.length === 0) missing.push("Communication history")
  if (!intel?.familyContext) missing.push("Family/household context")

  // Determine overall data quality
  const insufficientCount = Object.values(knownFacts).filter(f => f.confidence === "INSUFFICIENT").length
  let dataQuality: DataConfidence = "HIGH"
  if (insufficientCount >= 8) dataQuality = "INSUFFICIENT"
  else if (insufficientCount >= 5) dataQuality = "LOW"
  else if (insufficientCount >= 2) dataQuality = "MEDIUM"

  // --- Build GroundedSections ---
  const sections: GroundedSection[] = []

  // Section: Known Facts
  sections.push({
    title: "Known Facts",
    content: [
      `Name: ${knownFacts.name.value}`,
      `Type: ${knownFacts.type.value}`,
      `AUM: ${knownFacts.aum.value}`,
      `Risk Profile: ${knownFacts.riskProfile.value}`,
      `Life Stage: ${knownFacts.lifeStage.value}`,
      `Last Contact: ${knownFacts.lastContact.value} (${knownFacts.daysSinceContact.value})`,
      `Tags: ${knownFacts.tags.value}`,
    ],
    source: "STORED_FIELD",
    confidence: dataQuality,
    evidenceRecords: [`clients:${clientId}`],
  })

  // Section: Stated Goals (from IntelligenceProfile.goals — directly recorded)
  if (intel?.goals) {
    sections.push({
      title: "Stated Goals",
      content: intel.goals,
      source: "STORED_FIELD",
      confidence: "HIGH",
      evidenceRecords: [`intelligenceProfiles:${intel.id}`],
    })
  } else {
    sections.push({
      title: "Stated Goals",
      content: "Not recorded — add goals to the client intelligence profile",
      source: "STORED_FIELD",
      confidence: "INSUFFICIENT",
      missingData: ["intelligenceProfiles.goals"],
    })
  }

  // Section: Known Concerns (directly from IntelligenceProfile.concerns)
  if (intel?.concerns) {
    sections.push({
      title: "Known Concerns",
      content: intel.concerns,
      source: "STORED_FIELD",
      confidence: "HIGH",
      evidenceRecords: [`intelligenceProfiles:${intel.id}`],
    })
  }

  // Section: Communication Preferences (directly from IntelligenceProfile.communication)
  if (intel?.communication) {
    sections.push({
      title: "Communication Preferences",
      content: intel.communication,
      source: "STORED_FIELD",
      confidence: "HIGH",
      evidenceRecords: [`intelligenceProfiles:${intel.id}`],
    })
  }

  // Section: Family Context (directly from IntelligenceProfile.familyContext)
  if (intel?.familyContext) {
    sections.push({
      title: "Family & Household Context",
      content: intel.familyContext,
      source: "STORED_FIELD",
      confidence: "HIGH",
      evidenceRecords: [`intelligenceProfiles:${intel.id}`],
    })
  }

  // Section: Recent Life Events (from LifeEvent records)
  if (client.events.length > 0) {
    sections.push({
      title: "Recorded Life Events",
      content: client.events.map(e =>
        `${e.title}${e.type ? ` (${e.type})` : ""}${e.implications ? ` — ${e.implications}` : ""}`
      ),
      source: "STORED_FIELD",
      confidence: "HIGH",
      evidenceRecords: client.events.map(e => `lifeEvents:${e.id}`),
    })
  }

  // Section: Open Tasks
  if (client.tasks.length > 0) {
    sections.push({
      title: "Open Tasks",
      content: client.tasks.map(t =>
        `[${t.priority}] ${t.title}${t.dueDate ? ` — due ${new Date(t.dueDate).toLocaleDateString()}` : ""}${t.source !== "MANUAL" ? ` (${t.source})` : ""}`
      ),
      source: "STORED_FIELD",
      confidence: "HIGH",
      evidenceRecords: client.tasks.map(t => `tasks:${t.id}`),
    })
  }

  // Section: Open Opportunities
  if (client.opportunities.length > 0) {
    sections.push({
      title: "Open Opportunities",
      content: client.opportunities.map(o =>
        `[${o.type.replace(/_/g, " ")}] ${o.description} — ${o.suggestedAction} (confidence: ${Math.round(o.confidence)}%)`
      ),
      source: "STORED_FIELD",
      confidence: "HIGH",
      evidenceRecords: client.opportunities.map(o => `opportunities:${o.id}`),
    })
  }

  // Section: Tax Insights Under Review
  if (client.taxInsights.length > 0) {
    sections.push({
      title: "Tax Insights Under Review",
      content: client.taxInsights.map(t =>
        `[${t.urgency}] ${t.title} — ${t.suggestedAction}`
      ),
      source: "STORED_FIELD",
      confidence: "HIGH",
      evidenceRecords: client.taxInsights.map(t => `taxInsights:${t.id}`),
      missingData: ["Full tax return data", "Actual income figures", "Account contribution history"],
    })
  }

  // Section: Missing Data
  if (missing.length > 0) {
    sections.push({
      title: "Incomplete Profile — Missing Data",
      content: missing.map(m => `• ${m}`),
      source: "COMPUTED",
      confidence: "HIGH",
      missingData: missing,
    })
  }

  return {
    clientId,
    clientName: client.name,
    dataQuality,

    knownFacts,
    activityCounts,

    recentMeetings: client.meetings.map(m => ({
      title: m.title,
      date: new Date(m.scheduledAt).toLocaleDateString(),
      status: m.status,
      notes: m.notes,
    })),

    recentCommunications: client.communications.slice(0, 5).map(c => ({
      direction: c.direction,
      subject: c.subject,
      date: new Date(c.timestamp).toLocaleDateString(),
      type: c.type,
    })),

    openTasks: client.tasks.map(t => ({
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : null,
      source: t.source,
    })),

    lifeEvents: client.events.map(e => ({
      title: e.title,
      type: e.type,
      implications: e.implications,
    })),

    openOpportunities: client.opportunities.map(o => ({
      type: o.type,
      description: o.description,
      confidence: Math.round(o.confidence),
      suggestedAction: o.suggestedAction,
    })),

    taxInsights: client.taxInsights.map(t => ({
      title: t.title,
      urgency: t.urgency,
      status: t.status,
      rationale: t.rationale,
    })),

    intelligence: intel
      ? {
          sentimentScore: intel.sentimentScore,
          relationStrength: intel.relationStrength,
          churnScore: client.churnScore,
          lastUpdated: new Date(intel.lastUpdated).toLocaleDateString(),
          source: "STORED" as const,
        }
      : {
          sentimentScore: null,
          relationStrength: null,
          churnScore: client.churnScore,
          lastUpdated: null,
          source: "NOT_AVAILABLE" as const,
        },

    sections,
    missingData: missing,

    disclaimer:
      "This profile is assembled deterministically from stored records. No facts are inferred or invented. Sections marked 'Not recorded' indicate missing data in the database, not unknown facts.",
  }
}
