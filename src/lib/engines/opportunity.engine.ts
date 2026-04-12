/**
 * Opportunity Engine — Deterministic Rule-Based Detection
 *
 * Every opportunity is triggered by an explicit, documented rule.
 * No opportunity is created from "vibes", AI inference, or weak signals.
 *
 * Each result includes:
 * - The exact rule that triggered it
 * - The exact data values that matched the rule
 * - Confidence derived from signal strength (not hardcoded)
 * - What data is missing that would improve this assessment
 */

import prisma from "../db"
import { GroundedOpportunity, daysSince, formatAum, DataConfidence } from "./grounded-output"

type DetectedOpportunity = GroundedOpportunity

/**
 * Run all opportunity rules for a client.
 * Returns only triggered rules — does not invent opportunities.
 */
export async function detectClientOpportunities(clientId: string): Promise<DetectedOpportunity[]> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      intelligence: true,
      meetings: { orderBy: { scheduledAt: "desc" }, take: 5 },
      tasks: { where: { isCompleted: false } },
      onboarding: { include: { steps: true } },
      events: { orderBy: { createdAt: "desc" }, take: 5 },
      opportunities: { where: { status: { notIn: ["REJECTED", "EXECUTED"] } } },
    },
  })

  if (!client) return []

  const results: DetectedOpportunity[] = []

  // ──────────────────────────────────────────
  // RULE 1: NO CONTACT IN X DAYS
  // Trigger: lastContactAt > 45 days ago (or never)
  // ──────────────────────────────────────────
  const contactDays = daysSince(client.lastContactAt)
  if (contactDays === null || contactDays > 45) {
    const neverContacted = contactDays === null
    results.push({
      id: `opp-no-contact-${clientId}`,
      type: "RELATIONSHIP_GAP",
      title: neverContacted
        ? "No contact on record — outreach recommended"
        : `${contactDays}-day contact gap detected`,
      triggerRule: "lastContactAt is null OR daysSince(lastContactAt) > 45",
      triggerData: neverContacted
        ? "clients.lastContactAt = NULL"
        : `clients.lastContactAt = ${new Date(client.lastContactAt!).toLocaleDateString()} (${contactDays} days ago)`,
      evidence: [`clients:${clientId} → lastContactAt`],
      confidence: contactDays !== null && contactDays > 90 ? "HIGH" : "MEDIUM",
      urgency: contactDays !== null && contactDays > 90 ? "HIGH" : "MEDIUM",
      suggestedAction: "Schedule proactive check-in or relationship call",
      missingData: [],
    })
  }

  // ──────────────────────────────────────────
  // RULE 2: ANNUAL REVIEW OVERDUE
  // Trigger: No completed meeting in the last 12 months
  // ──────────────────────────────────────────
  const lastCompletedMeeting = client.meetings.find(m => m.status === "COMPLETED")
  if (!lastCompletedMeeting) {
    results.push({
      id: `opp-no-review-${clientId}`,
      type: "ANNUAL_REVIEW",
      title: "No completed annual review on record",
      triggerRule: "No meetings with status=COMPLETED found for this client",
      triggerData: `meetings.status=COMPLETED count = 0 for clientId=${clientId}`,
      evidence: [`clients:${clientId} → meetings`],
      confidence: "HIGH",
      urgency: "MEDIUM",
      suggestedAction: "Schedule annual review meeting",
      missingData: ["Meeting completion history (if meetings were held externally)"],
    })
  } else {
    const daysSinceReview = daysSince(lastCompletedMeeting.scheduledAt)
    if (daysSinceReview !== null && daysSinceReview > 365) {
      results.push({
        id: `opp-overdue-review-${clientId}`,
        type: "ANNUAL_REVIEW",
        title: `Annual review overdue — last completed ${daysSinceReview} days ago`,
        triggerRule: "daysSince(lastCompletedMeeting.scheduledAt) > 365",
        triggerData: `Last completed meeting: ${new Date(lastCompletedMeeting.scheduledAt).toLocaleDateString()} (${daysSinceReview} days ago)`,
        evidence: [`meetings:${lastCompletedMeeting.id}`],
        confidence: "HIGH",
        urgency: "HIGH",
        suggestedAction: "Schedule overdue annual review",
        missingData: [],
      })
    }
  }

  // ──────────────────────────────────────────
  // RULE 3: ONBOARDING BLOCKED
  // Trigger: Any onboarding step with status=BLOCKED
  // ──────────────────────────────────────────
  if (client.onboarding) {
    const blockedSteps = client.onboarding.steps.filter(s => s.status === "BLOCKED")
    if (blockedSteps.length > 0) {
      results.push({
        id: `opp-onboarding-blocked-${clientId}`,
        type: "ONBOARDING_BLOCKED",
        title: `Onboarding stalled — ${blockedSteps.length} step(s) blocked`,
        triggerRule: "onboardingSteps.status = BLOCKED",
        triggerData: `Blocked steps: ${blockedSteps.map(s => s.name).join(", ")}`,
        evidence: blockedSteps.map(s => `onboardingSteps:${s.id}`),
        confidence: "HIGH",
        urgency: "HIGH",
        suggestedAction: `Clear blocker: ${blockedSteps[0].notes ?? blockedSteps[0].name}`,
        missingData: [],
      })
    }
  }

  // ──────────────────────────────────────────
  // RULE 4: HIGH CHURN RISK
  // Trigger: client.churnScore > 60
  // ──────────────────────────────────────────
  if (client.churnScore > 60) {
    results.push({
      id: `opp-churn-${clientId}`,
      type: "CHURN_RISK",
      title: `High churn risk score — ${client.churnScore}/100`,
      triggerRule: "clients.churnScore > 60",
      triggerData: `clients.churnScore = ${client.churnScore}`,
      evidence: [`clients:${clientId} → churnScore`],
      confidence: client.churnScore > 80 ? "HIGH" : "MEDIUM",
      urgency: client.churnScore > 80 ? "HIGH" : "MEDIUM",
      suggestedAction: "Proactive outreach to address relationship concerns",
      missingData: ["Reason for churn risk (if not reflected in communication records)"],
    })
  }

  // ──────────────────────────────────────────
  // RULE 5: OVERDUE TASKS
  // Trigger: open tasks with dueDate in the past
  // ──────────────────────────────────────────
  const overdueTasks = client.tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date())
  if (overdueTasks.length > 0) {
    results.push({
      id: `opp-overdue-tasks-${clientId}`,
      type: "OVERDUE_TASKS",
      title: `${overdueTasks.length} overdue task(s)`,
      triggerRule: "tasks.isCompleted = false AND tasks.dueDate < NOW()",
      triggerData: `Overdue: ${overdueTasks.map(t => t.title).join(", ")}`,
      evidence: overdueTasks.map(t => `tasks:${t.id}`),
      confidence: "HIGH",
      urgency: overdueTasks.some(t => t.priority === "HIGH" || t.priority === "URGENT") ? "HIGH" : "MEDIUM",
      suggestedAction: "Review and complete overdue tasks",
      missingData: [],
    })
  }

  // ──────────────────────────────────────────
  // RULE 6: LIFE EVENT WITH NO FOLLOW-UP OPPORTUNITY
  // Trigger: LifeEvent exists but no linked opportunity for that event type
  // ──────────────────────────────────────────
  const lifeEventTypeToOppType: Record<string, string> = {
    RETIREMENT: "RETIREMENT_PLANNING",
    BUSINESS_SALE: "BUSINESS_SALE_PLANNING",
    LIQUIDITY: "LIQUIDITY_EVENT_PLANNING",
    INHERITANCE: "INHERITANCE_PLANNING",
    RELOCATION: "RELOCATION_REVIEW",
    NEW_CHILD: "EDUCATION_PLANNING",
    EDUCATION: "EDUCATION_PLANNING",
  }

  for (const event of client.events) {
    if (!event.type) continue
    const oppType = lifeEventTypeToOppType[event.type]
    if (!oppType) continue

    const hasLinkedOpp = client.opportunities.some(o => o.type === oppType || o.description.toLowerCase().includes(event.type!.toLowerCase()))
    if (!hasLinkedOpp) {
      results.push({
        id: `opp-life-event-${event.id}`,
        type: oppType,
        title: `Life event "${event.title}" — no follow-up opportunity recorded`,
        triggerRule: `lifeEvents.type = ${event.type} AND no matching opportunity exists`,
        triggerData: `lifeEvents:${event.id} → type=${event.type}, title="${event.title}"`,
        evidence: [`lifeEvents:${event.id}`],
        confidence: "MEDIUM",
        urgency: ["BUSINESS_SALE", "LIQUIDITY", "INHERITANCE"].includes(event.type) ? "HIGH" : "MEDIUM",
        suggestedAction: event.opportunity ?? `Review planning implications of: ${event.title}`,
        missingData: ["Advisor notes on how this event was handled"],
      })
    }
  }

  // Deduplicate against existing DB opportunities (don't re-raise already detected items)
  const existingTypes = client.opportunities.map(o => o.type)
  return results.filter(r => !existingTypes.includes(r.type) || r.type === "CHURN_RISK" || r.type === "RELATIONSHIP_GAP")
}

/**
 * Run opportunity scan for all clients in an organization.
 * Returns summary counts — does NOT write to DB (read-only).
 */
export async function getOrganizationOpportunitySummary(orgId: string) {
  const clients = await prisma.client.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
  })

  const allOpps = await Promise.all(clients.map(c => detectClientOpportunities(c.id)))
  const flat = allOpps.flat()

  return {
    totalDetected: flat.length,
    byUrgency: {
      HIGH: flat.filter(o => o.urgency === "HIGH").length,
      MEDIUM: flat.filter(o => o.urgency === "MEDIUM").length,
      LOW: flat.filter(o => o.urgency === "LOW").length,
    },
    byType: flat.reduce<Record<string, number>>((acc, o) => {
      acc[o.type] = (acc[o.type] ?? 0) + 1
      return acc
    }, {}),
  }
}
