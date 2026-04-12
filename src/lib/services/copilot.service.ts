/**
 * Advisor Copilot Service
 *
 * Orchestrated workflow engine for advisor queries.
 *
 * Flow for every prompt:
 * 1. Classify the request type
 * 2. Gather relevant app data (deterministic)
 * 3. Run deterministic checks first
 * 4. Build structured context for AI synthesis
 * 5. Call AI with strict grounding rules
 * 6. Return structured response + workflow trace
 * 7. Log the interaction
 *
 * RULES:
 * - AI may ONLY reference data provided in the context
 * - Missing data is surfaced explicitly, not filled by hallucination
 * - Tax/investment outputs are framed as draft review items
 * - All outputs require advisor review before use
 */

import prisma from "../db"
import { callClaudeJSON } from "./ai.service"

export type RequestType =
  | "MEETING_PREP"
  | "CLIENT_SUMMARY"
  | "TAX_REVIEW"
  | "OPPORTUNITY_SCAN"
  | "ONBOARDING_STATUS"
  | "DOCUMENT_SUMMARY"
  | "TASK_PRIORITIZATION"
  | "OUTREACH_DRAFT"
  | "FOLLOW_UP_PLANNING"
  | "GENERAL_QUERY"

export interface WorkflowTrace {
  requestType: RequestType
  inputsUsed: string[]
  deterministicChecks: string[]
  agentModulesUsed: string[]
  outputsGenerated: string[]
  confidence: "HIGH" | "MEDIUM" | "LOW"
  reviewRequired: boolean
  dataQuality: "COMPLETE" | "PARTIAL" | "INSUFFICIENT"
  missingData: string[]
  timestamp: string
}

export interface CopilotResponseSection {
  label: string
  content: string | string[]
  type: "answer" | "findings" | "actions" | "warning" | "draft" | "missing_data"
}

export interface CopilotResponse {
  id: string
  prompt: string
  sections: CopilotResponseSection[]
  trace: WorkflowTrace
  generatedAt: string
}

// ── Request classifier ───────────────────────────────────────────────────────

function classifyRequest(prompt: string): RequestType {
  const lower = prompt.toLowerCase()
  if (lower.includes("meeting") || lower.includes("prep") || lower.includes("brief")) return "MEETING_PREP"
  if (lower.includes("tax") || lower.includes("rmd") || lower.includes("harvest")) return "TAX_REVIEW"
  if (lower.includes("opportunit") || lower.includes("missing") || lower.includes("revenue")) return "OPPORTUNITY_SCAN"
  if (lower.includes("onboard")) return "ONBOARDING_STATUS"
  if (lower.includes("document") || lower.includes("doc ") || lower.includes("file")) return "DOCUMENT_SUMMARY"
  if (lower.includes("task") || lower.includes("priorit") || lower.includes("today") || lower.includes("follow")) return "TASK_PRIORITIZATION"
  if (lower.includes("email") || lower.includes("outreach") || lower.includes("draft") || lower.includes("message")) return "OUTREACH_DRAFT"
  if (lower.includes("summar") || lower.includes("client") || lower.includes("profile")) return "CLIENT_SUMMARY"
  return "GENERAL_QUERY"
}

// ── Data gathering per request type ─────────────────────────────────────────

async function gatherContext(type: RequestType, prompt: string, orgId: string) {
  const lower = prompt.toLowerCase()
  const inputsUsed: string[] = []
  const checks: string[] = []
  const missing: string[] = []
  let context: Record<string, unknown> = {}

  // Find client name mentioned in prompt (naive but effective for demo)
  const clients = await prisma.client.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
  })

  const mentionedClient = clients.find(c =>
    lower.includes(c.name.split(" ")[0].toLowerCase()) ||
    lower.includes(c.name.toLowerCase())
  )

  switch (type) {
    case "MEETING_PREP": {
      inputsUsed.push("meetings", "client profile", "tasks", "opportunities", "tax insights")

      // Find next scheduled meeting
      const nextMeeting = await prisma.meeting.findFirst({
        where: {
          status: "SCHEDULED",
          scheduledAt: { gte: new Date() },
          ...(mentionedClient ? { clientId: mentionedClient.id } : {}),
        },
        include: {
          client: {
            include: {
              intelligence: true,
              tasks: { where: { isCompleted: false }, take: 5 },
              opportunities: { where: { status: { in: ["DRAFT", "PENDING_REVIEW"] } }, take: 3 },
              taxInsights: { where: { status: "UNDER_REVIEW" }, take: 3 },
              events: { take: 3 },
            },
          },
        },
        orderBy: { scheduledAt: "asc" },
      })

      if (nextMeeting) {
        const c = nextMeeting.client
        checks.push(`Found next meeting: "${nextMeeting.title}" with ${c.name} on ${new Date(nextMeeting.scheduledAt).toLocaleDateString()}`)
        checks.push(`Checked open tasks: ${c.tasks.length} open`)
        checks.push(`Checked open opportunities: ${c.opportunities.length}`)
        checks.push(`Checked tax insights under review: ${c.taxInsights.length}`)
        checks.push(`Checked recorded life events: ${c.events.length}`)

        if (c.tasks.length === 0) missing.push("No open tasks on record for this client")
        if (!c.intelligence?.goals) missing.push("Client goals not recorded in intelligence profile")

        context = {
          meeting: {
            title: nextMeeting.title,
            date: new Date(nextMeeting.scheduledAt).toLocaleDateString(),
            type: nextMeeting.type,
          },
          client: {
            name: c.name,
            aum: c.aum ? `$${(c.aum / 1_000_000).toFixed(1)}M` : "Not on file",
            riskProfile: c.riskProfile ?? "Not on file",
            lastContact: c.lastContactAt ? `${Math.floor((Date.now() - c.lastContactAt.getTime()) / 86400000)} days ago` : "No contact recorded",
            goals: c.intelligence?.goals ?? null,
            concerns: c.intelligence?.concerns ?? null,
            lifeStage: c.intelligence?.lifeStage ?? null,
            churnScore: c.churnScore,
          },
          openTasks: c.tasks.map(t => ({ title: t.title, priority: t.priority, dueDate: t.dueDate?.toLocaleDateString() })),
          openOpportunities: c.opportunities.map(o => ({ type: o.type, description: o.description, action: o.suggestedAction })),
          taxInsights: c.taxInsights.map(t => ({ title: t.title, urgency: t.urgency, action: t.suggestedAction })),
          lifeEvents: c.events.map(e => ({ title: e.title, type: e.type, implications: e.implications })),
        }
      } else {
        checks.push("No upcoming scheduled meetings found")
        missing.push("No scheduled meetings on record")
        context = { noMeetings: true }
      }
      break
    }

    case "TAX_REVIEW": {
      inputsUsed.push("tax insights", "client profiles", "life events")
      const taxInsights = await prisma.taxInsight.findMany({
        where: { status: "UNDER_REVIEW", client: { organizationId: orgId } },
        include: { client: true },
        orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
        take: 10,
      })
      checks.push(`Found ${taxInsights.length} tax insights under review`)
      checks.push(`High urgency: ${taxInsights.filter(t => t.urgency === "HIGH").length}`)
      context = {
        taxInsights: taxInsights.map(t => ({
          client: t.client.name,
          title: t.title,
          urgency: t.urgency,
          rationale: t.rationale,
          action: t.suggestedAction,
          evidence: t.evidence,
        })),
      }
      if (taxInsights.length === 0) missing.push("No tax insights currently under review")
      break
    }

    case "OPPORTUNITY_SCAN": {
      inputsUsed.push("opportunities", "client profiles", "churn scores")
      const opps = await prisma.opportunity.findMany({
        where: { status: { in: ["DRAFT", "PENDING_REVIEW"] }, client: { organizationId: orgId } },
        include: { client: true },
        orderBy: { confidence: "desc" },
        take: 10,
      })
      const highChurn = await prisma.client.findMany({
        where: { organizationId: orgId, churnScore: { gt: 60 } },
        select: { name: true, churnScore: true, lastContactAt: true },
      })
      checks.push(`Found ${opps.length} open opportunities`)
      checks.push(`Found ${highChurn.length} clients with churn risk > 60`)
      context = {
        opportunities: opps.map(o => ({
          client: o.client.name,
          type: o.type,
          description: o.description,
          value: o.valueEst ? `$${(o.valueEst / 1000).toFixed(0)}k` : "Not estimated",
          confidence: Math.round(o.confidence),
          action: o.suggestedAction,
        })),
        churnRisk: highChurn.map(c => ({
          name: c.name,
          score: c.churnScore,
          lastContact: c.lastContactAt
            ? `${Math.floor((Date.now() - c.lastContactAt.getTime()) / 86400000)} days ago`
            : "Never",
        })),
      }
      break
    }

    case "TASK_PRIORITIZATION": {
      inputsUsed.push("tasks", "client churn scores", "opportunities")
      const tasks = await prisma.task.findMany({
        where: { isCompleted: false },
        include: { client: true },
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
        take: 15,
      })
      const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date())
      checks.push(`Found ${tasks.length} open tasks`)
      checks.push(`Overdue tasks: ${overdue.length}`)
      checks.push(`High/urgent priority: ${tasks.filter(t => t.priority === "HIGH" || t.priority === "URGENT").length}`)
      context = {
        tasks: tasks.map(t => ({
          title: t.title,
          client: t.client?.name ?? "No client",
          priority: t.priority,
          dueDate: t.dueDate?.toLocaleDateString() ?? "No due date",
          overdue: !!(t.dueDate && new Date(t.dueDate) < new Date()),
          source: t.source,
        })),
      }
      break
    }

    case "ONBOARDING_STATUS": {
      inputsUsed.push("onboarding workflows", "onboarding steps")
      const workflows = await prisma.onboardingWorkflow.findMany({
        where: { stage: { not: "COMPLETE" }, client: { organizationId: orgId } },
        include: { client: true, steps: true },
      })
      checks.push(`Found ${workflows.length} active onboarding workflows`)
      const blocked = workflows.filter(w => w.steps.some(s => s.status === "BLOCKED"))
      checks.push(`Blocked workflows: ${blocked.length}`)
      context = {
        workflows: workflows.map(w => ({
          client: w.client.name,
          stage: w.stage,
          healthScore: w.healthScore,
          blockedSteps: w.steps.filter(s => s.status === "BLOCKED").map(s => ({ name: s.name, notes: s.notes })),
          completedSteps: w.steps.filter(s => s.status === "COMPLETED").length,
          totalSteps: w.steps.length,
        })),
      }
      break
    }

    case "CLIENT_SUMMARY": {
      inputsUsed.push("client profile", "intelligence profile", "opportunities", "tasks", "tax insights")
      const target = mentionedClient
        ? await prisma.client.findUnique({
            where: { id: mentionedClient.id },
            include: {
              intelligence: true,
              tasks: { where: { isCompleted: false } },
              opportunities: { where: { status: { in: ["DRAFT", "PENDING_REVIEW"] } } },
              taxInsights: { where: { status: "UNDER_REVIEW" } },
              events: { take: 3 },
            },
          })
        : null

      if (target) {
        checks.push(`Found client: ${target.name}`)
        checks.push(`Open tasks: ${target.tasks.length}`)
        checks.push(`Open opportunities: ${target.opportunities.length}`)
        checks.push(`Tax insights: ${target.taxInsights.length}`)
        context = {
          client: {
            name: target.name,
            type: target.type,
            aum: target.aum ? `$${(target.aum / 1_000_000).toFixed(1)}M` : "Not on file",
            riskProfile: target.riskProfile ?? "Not on file",
            churnScore: target.churnScore,
            lastContact: target.lastContactAt
              ? `${Math.floor((Date.now() - target.lastContactAt.getTime()) / 86400000)} days ago`
              : "Never",
            goals: target.intelligence?.goals ?? null,
            concerns: target.intelligence?.concerns ?? null,
            familyContext: target.intelligence?.familyContext ?? null,
            sentimentScore: target.intelligence?.sentimentScore ?? null,
          },
          openTasks: target.tasks.map(t => ({ title: t.title, priority: t.priority })),
          openOpportunities: target.opportunities.map(o => ({ type: o.type, description: o.description })),
          taxInsights: target.taxInsights.map(t => ({ title: t.title, urgency: t.urgency })),
          lifeEvents: target.events.map(e => ({ title: e.title, type: e.type })),
        }
      } else {
        checks.push("No specific client identified from prompt")
        // Fall back to firm-wide summary
        const allClients = await prisma.client.findMany({
          where: { organizationId: orgId },
          select: { name: true, aum: true, churnScore: true },
        })
        context = {
          firmSummary: true,
          clientCount: allClients.length,
          totalAum: `$${(allClients.reduce((s, c) => s + (c.aum ?? 0), 0) / 1_000_000).toFixed(1)}M`,
          highChurnCount: allClients.filter(c => c.churnScore > 75).length,
        }
        missing.push("Specific client name not identified in prompt — showing firm summary")
      }
      break
    }

    default: {
      // General: grab high-level state
      inputsUsed.push("dashboard metrics")
      const [clientCount, oppCount, taxCount, taskCount] = await Promise.all([
        prisma.client.count({ where: { organizationId: orgId } }),
        prisma.opportunity.count({ where: { status: "DRAFT", client: { organizationId: orgId } } }),
        prisma.taxInsight.count({ where: { status: "UNDER_REVIEW", client: { organizationId: orgId } } }),
        prisma.task.count({ where: { isCompleted: false } }),
      ])
      checks.push(`Checked firm metrics: ${clientCount} clients, ${oppCount} open opps, ${taxCount} tax insights, ${taskCount} open tasks`)
      context = { clientCount, oppCount, taxCount, taskCount }
    }
  }

  return { context, inputsUsed, checks, missing }
}

// ── Main orchestrator ────────────────────────────────────────────────────────

export async function runCopilot(prompt: string, orgId: string): Promise<CopilotResponse> {
  const id = `cop-${Date.now()}`
  const requestType = classifyRequest(prompt)
  const { context, inputsUsed, checks, missing } = await gatherContext(requestType, prompt, orgId)

  const agentModules: Record<RequestType, string[]> = {
    MEETING_PREP: ["Meeting Brief Agent", "Client Intelligence Agent"],
    TAX_REVIEW: ["Tax Agent", "Compliance Review Agent"],
    OPPORTUNITY_SCAN: ["Client Intelligence Agent", "Sales Agent"],
    TASK_PRIORITIZATION: ["Workflow Orchestrator"],
    ONBOARDING_STATUS: ["Workflow Orchestrator"],
    CLIENT_SUMMARY: ["Client Intelligence Agent"],
    DOCUMENT_SUMMARY: ["Document Intelligence Agent"],
    OUTREACH_DRAFT: ["Relationship Agent", "Sales Agent"],
    FOLLOW_UP_PLANNING: ["Relationship Agent", "Workflow Orchestrator"],
    GENERAL_QUERY: ["Workflow Orchestrator"],
  }

  const agentModulesUsed = agentModules[requestType]
  const dataQuality = missing.length === 0 ? "COMPLETE" : Object.keys(context).length > 2 ? "PARTIAL" : "INSUFFICIENT"

  let sections: CopilotResponseSection[] = []

  // Add missing data notice first if needed
  if (missing.length > 0) {
    sections.push({
      label: "Data Gaps",
      content: missing,
      type: "missing_data",
    })
  }

  // Try AI synthesis
  try {
    const systemPrompt = `You are an Advisor Copilot for a financial advisory firm. Your job is to help financial advisors prepare for meetings, review opportunities, and make better decisions.

STRICT RULES:
1. ONLY reference information explicitly provided in the context data below
2. Do NOT invent client facts, portfolio figures, or financial outcomes
3. If data is missing, acknowledge it — do NOT fill gaps with assumptions
4. Tax/investment outputs must be framed as: "draft review items — advisor judgment required"
5. Be specific and actionable — reference actual names, tasks, and data from the context
6. Professional, direct tone — no marketing language, no hype
7. Structure your response clearly with labeled sections`

    const userMessage = `Advisor request: "${prompt}"
Request type: ${requestType}

Available data:
${JSON.stringify(context, null, 2)}

${missing.length > 0 ? `Note — these data gaps exist and should be acknowledged:\n${missing.join('\n')}` : ''}

Return a JSON response with this structure:
{
  "answer": "Direct response to the advisor's question, referencing actual data",
  "keyFindings": ["finding 1 — cite the specific data", "finding 2", ...],
  "recommendedActions": ["action 1 — specific and actionable", "action 2", ...],
  "reviewWarnings": ["anything that requires advisor judgment or professional review"],
  "draftContent": "Only if the request is for a draft/outreach — the actual draft text, or null"
}`

    const result = await callClaudeJSON<{
      answer: string
      keyFindings: string[]
      recommendedActions: string[]
      reviewWarnings: string[]
      draftContent: string | null
    }>(systemPrompt, userMessage, 4096)

    if (result.answer) {
      sections.push({ label: "Answer", content: result.answer, type: "answer" })
    }
    if (result.keyFindings?.length > 0) {
      sections.push({ label: "Key Findings", content: result.keyFindings, type: "findings" })
    }
    if (result.recommendedActions?.length > 0) {
      sections.push({ label: "Recommended Next Actions", content: result.recommendedActions, type: "actions" })
    }
    if (result.reviewWarnings?.length > 0) {
      sections.push({ label: "Review Warnings", content: result.reviewWarnings, type: "warning" })
    }
    if (result.draftContent) {
      sections.push({ label: "Draft Content", content: result.draftContent, type: "draft" })
    }
  } catch (err) {
    console.warn("[CopilotService] AI synthesis failed:", err)
    // Honest fallback — just surface the data
    sections = [
      {
        label: "Data Retrieved",
        content: `AI synthesis unavailable. Retrieved data for request type: ${requestType}. Summary: ${JSON.stringify(context).slice(0, 400)}...`,
        type: "answer",
      },
    ]
    if (missing.length > 0) {
      sections.push({ label: "Missing Data", content: missing, type: "missing_data" })
    }
  }

  const trace: WorkflowTrace = {
    requestType,
    inputsUsed,
    deterministicChecks: checks,
    agentModulesUsed,
    outputsGenerated: sections.map(s => s.label),
    confidence: dataQuality === "COMPLETE" ? "HIGH" : dataQuality === "PARTIAL" ? "MEDIUM" : "LOW",
    reviewRequired: requestType === "TAX_REVIEW" || requestType === "OUTREACH_DRAFT",
    dataQuality,
    missingData: missing,
    timestamp: new Date().toISOString(),
  }

  // Audit log
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: "COPILOT_QUERY",
        target: `CopilotSession:${id}`,
        details: `Copilot query: "${prompt.slice(0, 100)}". Type: ${requestType}. Data quality: ${dataQuality}. Sections: ${sections.length}.`,
        aiInvolved: true,
        severity: "INFO",
      },
    })
  } catch {
    // Don't fail the response if audit log fails
  }

  return {
    id,
    prompt,
    sections,
    trace,
    generatedAt: new Date().toISOString(),
  }
}

export const SUGGESTED_PROMPTS = [
  "Prepare me for my next scheduled meeting",
  "What tax items need review this month?",
  "Which clients are at risk of churning?",
  "What opportunities are we missing across clients?",
  "What tasks are overdue or need attention today?",
  "Summarize the current onboarding pipeline",
  "Draft an outreach email for a client check-in",
  "What follow-ups are outstanding this week?",
]
