import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  MEETING_PREP_RETRIEVAL,
  normalizeQuery,
  retrieveRegulatoryEvidenceForMeeting,
  retrieveTenantDocumentEvidence,
  type MeetingPrepRetrievalTrace,
} from "@/lib/meeting-prep/meeting-prep-retrieval";
import {
  atomizeDraftClaims,
  buildVerifiedDraftSections,
  verifyAtomicClaimsAgainstEvidence,
  type VerifiedInternalClaim,
} from "@/lib/meeting-prep/claim-verification";
import {
  FINAL_BRIEF_SECTION_ORDER,
  type ClassifyMeetingOutput,
  type CritiqueBriefOutput,
  type DraftBriefOutput,
  type DraftBriefSection,
  type ExtractKeyFactsOutput,
  type RetrieveContextOutput,
  type RetrievedChunk,
  type VerifyClaimsOutput,
} from "@/lib/meeting-prep/workflow-schemas";
import { callClaudeJSON } from "@/lib/services/ai.service";
import { ComplianceService } from "@/lib/services/compliance.service";

interface EvidenceItem {
  id: string;
  kind: string;
  title: string;
  sectionPath: string;
  text: string;
  effectiveDate: string | null;
  authorityLevel: string;
  sourceDocumentId?: string | null;
  documentType?: string | null;
  sourceName?: string | null;
  retrieval_quality_note?: string | null;
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreText(text: string, query: string) {
  const haystack = normalizeText(text);
  const terms = normalizeText(query).split(" ").filter((term) => term.length > 2);
  if (terms.length === 0) return 0;
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function mapKindToDocumentType(kind: string, documentType?: string | null): string {
  if (documentType) return documentType;
  switch (kind) {
    case "meeting_note":
      return "PRIOR_MEETING_NOTE";
    case "document_chunk":
      return "VAULT_DOCUMENT";
    case "task":
      return "CRM_TASK";
    case "tax_insight":
      return "TAX_CONTEXT";
    case "compliance_flag":
      return "COMPLIANCE_RECORD";
    case "holding":
      return "HOLDING_SNAPSHOT";
    case "deterministic_calculation":
      return "DETERMINISTIC_CALCULATION";
    case "client_profile":
      return "CLIENT_PROFILE";
    case "regulatory_corpus":
      return "REGULATORY_REFERENCE";
    default:
      return "OTHER";
  }
}

const REQUIRED_DRAFT_SECTION_TITLES = FINAL_BRIEF_SECTION_ORDER.slice(0, 7);

export class MeetingPrepService {
  /** Step 1 — classify_meeting */
  private static async classifyMeetingWorkflow(context: Record<string, unknown>): Promise<ClassifyMeetingOutput> {
    try {
      return await callClaudeJSON<ClassifyMeetingOutput>(
        `You classify upcoming RIA client meetings for preparation.

Return JSON only with keys:
- meeting_type (short label, e.g. quarterly_review, tax_planning, prospect_discovery)
- meeting_objectives (string array)
- required_sections (subset of advisor brief sections relevant to this meeting)
- missing_inputs (data gaps such as stale custodian sync, missing IPS upload — empty array if none)

Suggested required_sections vocabulary (pick what applies):
Meeting purpose, Client snapshot, Open action items, Portfolio / planning flags, Compliance or policy flags, Discussion opportunities, Unresolved questions`,
        JSON.stringify(context),
        { organizationId: context.organizationId as string, maxTokens: 700, feature: "MEETING_PREP_CLASSIFY" },
      );
    } catch {
      return MeetingPrepService.classifyMeetingFallback(context);
    }
  }

  private static classifyMeetingFallback(context: Record<string, unknown>): ClassifyMeetingOutput {
    const meeting = context.meeting as { type?: string } | undefined;
    const normalized = (meeting?.type ?? "review").toLowerCase();
    const meeting_type = normalized.includes("tax")
      ? "tax_planning"
      : normalized.includes("plan")
        ? "financial_planning"
        : normalized.includes("intro") || normalized.includes("prospect")
          ? "prospect_discovery"
          : "quarterly_review";

    const missing_inputs: string[] = [];
    const loaded = context.advisor_context as ReturnType<typeof MeetingPrepService.buildAdvisorWorkflowInput> | undefined;
    if (loaded && loaded.holdings.accounts_count === 0) {
      missing_inputs.push("No custodian-linked accounts on file for holdings verification.");
    }

    return {
      meeting_type,
      meeting_objectives: ["Review household objectives and evidence-backed agenda."],
      required_sections: [...REQUIRED_DRAFT_SECTION_TITLES],
      missing_inputs,
    };
  }

  /** Assembles CRM / vault / calendar / portfolio inputs for downstream steps. */
  private static buildAdvisorWorkflowInput(
    loaded: Awaited<ReturnType<typeof MeetingPrepService.loadEvidence>>,
    meetingId: string,
  ) {
    const { meeting, complianceFlags } = loaded;
    const client = meeting.client;

    const priorNotes = client.meetings
      .filter((m) => m.id !== meeting.id && m.status === "COMPLETED")
      .slice(0, 3)
      .map((m) => ({
        meeting_id: m.id,
        title: m.title,
        scheduled_at: m.scheduledAt.toISOString(),
        notes_excerpt: (m.notes ?? m.briefText ?? "").slice(0, 4000),
      }));

    const vaultDocuments = client.documents.map((d) => ({
      document_id: d.id,
      file_name: d.fileName,
      title: d.title,
      document_type: d.documentType ?? null,
      status: d.status,
      uploaded_at: d.uploadedAt.toISOString(),
    }));

    const accounts = client.accounts.map((a) => ({
      account_id: a.id,
      name: a.accountName,
      custodian: a.custodian,
      current_value: a.currentValue,
      last_synced: a.lastSyncedAt?.toISOString() ?? null,
      holdings_count: a.holdings.length,
    }));

    return {
      client_profile: {
        client_id: client.id,
        household_name: client.name,
        risk_profile: client.riskProfile,
        goals: client.intelligence?.goals ?? null,
        concerns: client.intelligence?.concerns ?? null,
        communication_preferences: client.intelligence?.communication ?? null,
      },
      crm_open_tasks: client.tasks.slice(0, 12).map((t) => ({
        task_id: t.id,
        title: t.title,
        due: t.dueDate?.toISOString() ?? null,
        completed: t.isCompleted,
      })),
      calendar_meeting: {
        meeting_id: meetingId,
        title: meeting.title,
        type: meeting.type,
        scheduled_at: meeting.scheduledAt.toISOString(),
        status: meeting.status,
        raw_calendar_context: meeting.rawCalendarContext,
      },
      last_meeting_notes: priorNotes,
      vault_documents: vaultDocuments,
      holdings: {
        accounts_count: accounts.length,
        accounts,
      },
      tax_context: client.taxInsights.slice(0, 8).map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        rationale: t.rationale,
        suggested_action: t.suggestedAction,
      })),
      compliance_flags: complianceFlags.map((f) => ({
        id: f.id,
        type: f.type,
        severity: f.severity,
        description: f.description,
      })),
    };
  }

  /** Step 2 — retrieve_context (chunk rows + relevance reasons). */
  private static async enrichRetrieveContext(
    evidence: EvidenceItem[],
    context: {
      meetingTitle: string;
      meeting_type: string;
      meeting_objectives: string[];
      organizationId: string;
    },
  ): Promise<RetrieveContextOutput> {
    const base = evidence.map((item) => ({
      chunk_id: item.id,
      document_id: item.sourceDocumentId ?? item.id,
      document_type: mapKindToDocumentType(item.kind, item.documentType),
      source_name: item.sourceName ?? item.title,
      authority_tier: item.authorityLevel,
      effective_date: item.effectiveDate ?? "",
      text: item.text.slice(0, 6000),
      relevance_reason: "",
      retrieval_quality_note: item.retrieval_quality_note ?? undefined,
    }));

    try {
      const filled = await callClaudeJSON<{ retrieved_chunks: RetrievedChunk[] }>(
        `You label retrieved context for an advisor meeting.

For EACH object in the input array, set "relevance_reason" to one sentence: why this chunk matters for THIS meeting (tie to objectives). If "retrieval_quality_note" is present, acknowledge it in your reason (do not contradict it). Keep chunk_id, document_id, text, and other fields unchanged. Do not invent facts.

Return JSON only: { "retrieved_chunks": [ ... ] }`,
        JSON.stringify({
          meeting: { title: context.meetingTitle, meeting_type: context.meeting_type, objectives: context.meeting_objectives },
          chunks: base,
        }),
        { organizationId: context.organizationId, maxTokens: 2200, feature: "GENERAL" },
      );

      const merged = new Map(base.map((row) => [row.chunk_id, row]));
      for (const row of filled.retrieved_chunks ?? []) {
        const prev = merged.get(row.chunk_id);
        if (prev) {
          merged.set(row.chunk_id, { ...prev, ...row, text: prev.text });
        }
      }
      return { retrieved_chunks: [...merged.values()] as RetrievedChunk[] };
    } catch {
      return {
        retrieved_chunks: base.map((row) => ({
          ...row,
          relevance_reason: "Retrieved for this meeting based on hybrid ranking (lexical + semantic + authority).",
        })),
      };
    }
  }

  /** Step 3 — extract_key_facts */
  private static async extractKeyFactsWorkflow(params: {
    organizationId: string;
    classify: ClassifyMeetingOutput;
    retrieve_context: RetrieveContextOutput;
    advisor_context: ReturnType<typeof MeetingPrepService.buildAdvisorWorkflowInput>;
  }): Promise<ExtractKeyFactsOutput> {
    const empty: ExtractKeyFactsOutput = {
      client_facts: [],
      open_action_items: [],
      portfolio_flags: [],
      tax_flags: [],
      compliance_flags: [],
      opportunities_to_discuss: [],
      unresolved_questions: [],
    };

    try {
      return await callClaudeJSON<ExtractKeyFactsOutput>(
        `Extract structured facts for meeting preparation. Use ONLY information present in advisor_context and retrieve_context.

Return JSON only with keys:
client_facts, open_action_items, portfolio_flags, tax_flags, compliance_flags, opportunities_to_discuss, unresolved_questions
(each an array of concise strings; cite chunk_id in parentheses when sourced from retrieve_context, e.g. "(chunk_abc123)").`,
        JSON.stringify(params),
        { organizationId: params.organizationId, maxTokens: 2800, feature: "MEETING_PREP_EXTRACT" },
      );
    } catch {
      return empty;
    }
  }

  /** Step 4 — draft_brief */
  private static async draftBriefWorkflow(params: {
    organizationId: string;
    meeting_type: string;
    extract: ExtractKeyFactsOutput;
    retrieve_context: RetrieveContextOutput;
    classify: ClassifyMeetingOutput;
    regenerationHint?: string;
  }): Promise<DraftBriefOutput> {
    const sectionTitles = REQUIRED_DRAFT_SECTION_TITLES.join(", ");
    try {
      const payload =
        params.regenerationHint ?
          {
            ...params,
            regenerationHint:
              "Prior version had verification gaps. Rewrite using only extract + retrieved chunks; every claim must list valid source_chunk_ids.",
          }
        : params;

      return await callClaudeJSON<DraftBriefOutput>(
        `Draft a structured meeting prep brief for an RIA advisor.

Return JSON only:
{ "sections": [ { "title": string, "content": string, "claims": [ { "text": string, "source_chunk_ids": string[] } ] } ] }

Rules:
1. Include exactly these section titles in order: ${sectionTitles}
2. Every substantive claim must list one or more source_chunk_ids from retrieve_context.retrieved_chunks.
3. Use deterministic-style facts only with chunk ids like calc:portfolio_summary or client:… when present in retrieval.
4. If a section has no evidence, write exactly: "No substantive information available — see missing inputs from classification." for content and leave claims empty.
5. Tone: serious, concise, professional.`,
        JSON.stringify(payload),
        {
          organizationId: params.organizationId,
          maxTokens: 3600,
          feature: params.regenerationHint ? "MEETING_PREP_REGENERATE" : "MEETING_PREP_DRAFT",
        },
      );
    } catch {
      return MeetingPrepService.draftBriefFallback(params);
    }
  }

  private static draftBriefFallback(params: {
    extract: ExtractKeyFactsOutput;
    classify: ClassifyMeetingOutput;
  }): DraftBriefOutput {
    const blocks = params.extract;
    const lines = (label: string, rows: string[]) =>
      rows.length ? `${label}:\n${rows.map((r) => `- ${r}`).join("\n")}` : `${label}: —`;

    const sections: DraftBriefSection[] = REQUIRED_DRAFT_SECTION_TITLES.map((title) => {
      let content = "";
      if (title === "Meeting purpose") {
        content = params.classify.meeting_objectives.join(" ") || "Meeting objectives not classified.";
      } else if (title === "Client snapshot") {
        content = lines("Facts", blocks.client_facts);
      } else if (title === "Open action items") {
        content = lines("Items", blocks.open_action_items);
      } else if (title === "Portfolio / planning flags") {
        content = lines("Flags", blocks.portfolio_flags);
      } else if (title === "Compliance or policy flags") {
        content = lines("Flags", [...blocks.compliance_flags, ...blocks.tax_flags]);
      } else if (title === "Discussion opportunities") {
        content = lines("Topics", blocks.opportunities_to_discuss);
      } else if (title === "Unresolved questions") {
        content = lines("Questions", blocks.unresolved_questions);
      }

      return { title, content, claims: [] };
    });

    return { sections };
  }

  /** Step 5 — critique_brief */
  private static async critiqueBriefWorkflow(params: {
    organizationId: string;
    draft: DraftBriefOutput;
    retrieve_context: RetrieveContextOutput;
    classify: ClassifyMeetingOutput;
  }): Promise<CritiqueBriefOutput> {
    try {
      return await callClaudeJSON<CritiqueBriefOutput>(
        `Critique this meeting prep draft.

Return JSON only with keys:
missing_sections, generic_sections, unsupported_claims, recommended_fixes (all string arrays).

Compare draft sections to required coverage and retrieved_chunks.`,
        JSON.stringify(params),
        { organizationId: params.organizationId, maxTokens: 900, feature: "MEETING_PREP_CRITIQUE" },
      );
    } catch {
      return {
        missing_sections: [],
        generic_sections: [],
        unsupported_claims: [],
        recommended_fixes: [],
      };
    }
  }

  /** Phase 4 — atomic claims + semantic verification before formatting. */
  private static async runClaimVerificationPhase(
    draft_brief: DraftBriefOutput,
    evidenceMap: Map<string, EvidenceItem>,
    ctx: { meetingId: string; organizationId: string },
  ): Promise<{ verify_claims: VerifyClaimsOutput; verifiedSections: DraftBriefSection[] }> {
    const atoms = await atomizeDraftClaims(draft_brief, ctx.organizationId);
    const checked = verifyAtomicClaimsAgainstEvidence(atoms, evidenceMap, ctx);
    const verifiedSections = buildVerifiedDraftSections(REQUIRED_DRAFT_SECTION_TITLES, checked);
    const verify_claims: VerifyClaimsOutput = {
      claims: checked.map((c: VerifiedInternalClaim) => ({
        claim_text: c.claim_text,
        claim_type: String(c.claim_type),
        section_title: c.section_title,
        source_chunk_ids: c.source_chunk_ids,
        calculation_inputs: c.calculation_inputs,
        verification_status: c.verification_status,
        explanation: c.explanation,
      })),
    };
    return { verify_claims, verifiedSections };
  }

  /** Step 7 — format_final_output */
  private static formatFinalAdvisorBriefDeterministic(
    verifiedSections: DraftBriefSection[],
    retrieveContext: RetrieveContextOutput,
    classify: ClassifyMeetingOutput,
  ): string {
    const lines: string[] = ["# Meeting preparation brief", ""];

    for (const title of REQUIRED_DRAFT_SECTION_TITLES) {
      const section = verifiedSections.find((s) => s.title.trim() === title);
      lines.push(`## ${title}`);
      lines.push(section?.content?.trim() || "_No substantive information available._");
      lines.push("");
    }

    lines.push("## Sources / citations");
    if (retrieveContext.retrieved_chunks.length === 0) {
      lines.push("_No document chunks retrieved._");
    } else {
      for (const ch of retrieveContext.retrieved_chunks) {
        const datePart = ch.effective_date ? ` · Effective ${ch.effective_date}` : "";
        lines.push(
          `- **${ch.chunk_id}** — ${ch.source_name} (${ch.document_type})${datePart}: ${ch.relevance_reason}`,
        );
      }
    }

    if (classify.missing_inputs.length > 0) {
      lines.push("", "## Data gaps");
      for (const gap of classify.missing_inputs) lines.push(`- ${gap}`);
    }

    return lines.join("\n").trim();
  }

  private static async formatFinalOutputWorkflow(params: {
    organizationId: string;
    deterministicMarkdown: string;
    verifiedSections: DraftBriefSection[];
    retrieve_context: RetrieveContextOutput;
    classify: ClassifyMeetingOutput;
    critique: CritiqueBriefOutput;
  }): Promise<string> {
    try {
      const result = await callClaudeJSON<{ markdown: string }>(
        `Polish this advisor meeting prep brief for final delivery.

Rules:
- Preserve all factual content and citation chunk ids in Sources; do not invent data.
- Use exactly these H2 headings in order: ${FINAL_BRIEF_SECTION_ORDER.join(", ")}
- Unsupported claims must not appear (already removed upstream).
- Tone: serious, concise, appropriate for an RIA advisor.
- Include "Sources / citations" from provided retrieve_context listing chunk ids.

Return JSON only: { "markdown": "..." }`,
        JSON.stringify({
          draft_markdown: params.deterministicMarkdown,
          critique: params.critique,
          retrieve_context: params.retrieve_context,
          classify: params.classify,
        }),
        { organizationId: params.organizationId, maxTokens: 4500, feature: "MEETING_PREP_FORMAT_FINAL" },
      );
      return result.markdown?.trim() || params.deterministicMarkdown;
    } catch {
      return params.deterministicMarkdown;
    }
  }

  private static async loadEvidence(meetingId: string) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        client: {
          include: {
            intelligence: true,
            tasks: { where: { isCompleted: false }, orderBy: { createdAt: "asc" } },
            meetings: { orderBy: { scheduledAt: "desc" }, take: 6 },
            taxInsights: { where: { status: { in: ["UNDER_REVIEW", "ACCEPTED"] } }, orderBy: { createdAt: "desc" } },
            documents: {
              where: { status: { in: ["SUMMARIZED", "REVIEWED"] } },
              include: { chunks: true },
              orderBy: { uploadedAt: "desc" },
            },
            accounts: {
              include: { holdings: true },
              orderBy: { updatedAt: "desc" },
            },
          },
        },
      },
    });

    if (!meeting) throw new Error("Meeting not found.");

    const householdId = meeting.householdId ?? meeting.client.householdId ?? null;
    const complianceFlags = await prisma.complianceFlag.findMany({
      where: {
        organizationId: meeting.client.organizationId,
        status: { in: ["OPEN", "UNDER_REVIEW"] },
        OR: [{ targetId: meeting.client.id }, { targetId: meeting.id }],
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 10,
    });

    return { meeting, householdId, complianceFlags };
  }

  private static buildStructuredEvidence(input: Awaited<ReturnType<typeof MeetingPrepService.loadEvidence>>) {
    const { meeting, complianceFlags } = input;
    const evidence: EvidenceItem[] = [];

    const priorMeetings = meeting.client.meetings
      .filter((item) => item.id !== meeting.id && item.status === "COMPLETED")
      .slice(0, 3);

    for (const item of priorMeetings) {
      if (!item.notes && !item.briefText) continue;
      evidence.push({
        id: `meeting:${item.id}`,
        kind: "meeting_note",
        title: item.title,
        sectionPath: "Prior Meeting",
        text: item.notes ?? item.briefText ?? "",
        effectiveDate: item.scheduledAt.toISOString(),
        authorityLevel: "medium",
        documentType: "PRIOR_MEETING_NOTE",
        sourceName: item.title,
      });
    }

    for (const task of meeting.client.tasks.slice(0, 10)) {
      evidence.push({
        id: `task:${task.id}`,
        kind: "task",
        title: task.title,
        sectionPath: "Open Task",
        text: `${task.title}${task.description ? ` — ${task.description}` : ""}${task.dueDate ? ` — due ${task.dueDate.toISOString()}` : ""}`,
        effectiveDate: task.dueDate?.toISOString() ?? null,
        authorityLevel: "medium",
        documentType: "CRM_TASK",
        sourceName: "CRM",
      });
    }

    for (const taxInsight of meeting.client.taxInsights.slice(0, 6)) {
      evidence.push({
        id: `tax:${taxInsight.id}`,
        kind: "tax_insight",
        title: taxInsight.title,
        sectionPath: taxInsight.category ?? "Tax",
        text: `${taxInsight.rationale} Suggested action: ${taxInsight.suggestedAction}`,
        effectiveDate: taxInsight.updatedAt.toISOString(),
        authorityLevel: "medium",
        documentType: "TAX_CONTEXT",
        sourceName: taxInsight.title,
      });
    }

    for (const flag of complianceFlags) {
      evidence.push({
        id: `flag:${flag.id}`,
        kind: "compliance_flag",
        title: flag.type,
        sectionPath: "Compliance",
        text: flag.description,
        effectiveDate: flag.updatedAt.toISOString(),
        authorityLevel: "high",
        documentType: "COMPLIANCE_RECORD",
        sourceName: flag.type,
      });
    }

    const holdings = meeting.client.accounts.flatMap((account) =>
      account.holdings.map((holding) => ({ account, holding })),
    );
    const totalHoldingsValue = holdings.reduce((sum, item) => sum + (item.holding.marketValue ?? 0), 0);
    const totalAccountValue = meeting.client.accounts.reduce((sum, account) => sum + (account.currentValue ?? 0), 0);
    const totalPortfolioValue = totalHoldingsValue > 0 ? totalHoldingsValue : totalAccountValue;

    if (meeting.client.accounts.length > 0) {
      evidence.push({
        id: "calc:portfolio_summary",
        kind: "deterministic_calculation",
        title: "Portfolio Summary",
        sectionPath: "Current Holdings",
        text: `Portfolio value ${formatCurrency(totalPortfolioValue)} across ${meeting.client.accounts.length} account(s).`,
        effectiveDate: new Date().toISOString(),
        authorityLevel: "high",
        documentType: "DETERMINISTIC_CALCULATION",
        sourceName: "Custodian aggregation",
      });
    }

    for (const { account, holding } of holdings
      .sort((left, right) => (right.holding.marketValue ?? 0) - (left.holding.marketValue ?? 0))
      .slice(0, 10)) {
      evidence.push({
        id: `holding:${holding.id}`,
        kind: "holding",
        title: holding.symbol,
        sectionPath: `${account.accountName} / ${holding.assetClass}`,
        text: `${holding.name} (${holding.symbol}) market value ${formatCurrency(holding.marketValue)}${holding.weightPercent ? `, weight ${holding.weightPercent.toFixed(2)}%` : ""}.`,
        effectiveDate: account.lastSyncedAt?.toISOString() ?? null,
        authorityLevel: "high",
        documentType: "HOLDING_SNAPSHOT",
        sourceName: account.accountName ?? account.custodian,
      });
    }

    const clientSummaryLines = [
      `Household: ${meeting.client.name}`,
      `Risk profile: ${meeting.client.riskProfile ?? "Not recorded"}`,
      `Goals: ${meeting.client.intelligence?.goals ?? "Not recorded"}`,
      `Concerns: ${meeting.client.intelligence?.concerns ?? "Not recorded"}`,
      `Communication preferences: ${meeting.client.intelligence?.communication ?? "Not recorded"}`,
    ];

    evidence.push({
      id: `client:${meeting.client.id}`,
      kind: "client_profile",
      title: meeting.client.name,
      sectionPath: "Client Profile",
      text: clientSummaryLines.join("\n"),
      effectiveDate: meeting.client.updatedAt.toISOString(),
      authorityLevel: "high",
      documentType: "CLIENT_PROFILE",
      sourceName: meeting.client.name,
    });

    return evidence;
  }

  private static keywordSearch(chunks: EvidenceItem[], queries: string[]) {
    return chunks
      .map((item) => ({
        item,
        score: queries.reduce((sum, query) => sum + scoreText(`${item.title} ${item.sectionPath} ${item.text}`, query), 0),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);
  }

  private static async rerankEvidence(candidates: EvidenceItem[], context: { meetingTitle: string; organizationId: string }) {
    if (candidates.length <= MEETING_PREP_RETRIEVAL.FINAL_CHUNKS) return candidates;

    try {
      const result = await callClaudeJSON<{ orderedIds: string[] }>(
        `Rerank evidence for an advisor meeting prep task. Return JSON only with orderedIds.`,
        JSON.stringify({
          meetingTitle: context.meetingTitle,
          candidates: candidates.map((candidate) => ({
            id: candidate.id,
            title: candidate.title,
            sectionPath: candidate.sectionPath,
            text: candidate.text.slice(0, 280),
          })),
        }),
        { organizationId: context.organizationId, maxTokens: 500, feature: "MEETING_PREP_RERANK" },
      );

      const order = new Map((result.orderedIds ?? []).map((id, index) => [id, index]));
      return [...candidates].sort((left, right) => (order.get(left.id) ?? 999) - (order.get(right.id) ?? 999));
    } catch {
      return candidates;
    }
  }

  private static async rewriteRetrievalQueries(input: {
    meetingTitle: string;
    meeting_type: string;
    meeting_objectives: string[];
    clientName: string;
    organizationId: string;
  }) {
    try {
      const result = await callClaudeJSON<{ queries: string[] }>(
        `Write concise retrieval queries for advisor meeting prep covering vault documents, IPS/policy, fees, compliance, prior notes, and portfolio context. Return JSON only with key "queries".`,
        JSON.stringify(input),
        { organizationId: input.organizationId, maxTokens: 400, feature: "MEETING_PREP_QUERY_REWRITE" },
      );
      const extra = [
        `${input.clientName} investment policy statement IPS`,
        `${input.clientName} advisory fee schedule`,
        `${input.clientName} compliance restriction`,
      ];
      return [...(result.queries ?? []), ...extra].filter(Boolean).slice(0, 8);
    } catch {
      return [
        `${input.clientName} ${input.meeting_type} meeting notes`,
        `${input.clientName} IPS constraints`,
        `${input.clientName} advisory fee`,
        `${input.clientName} tax considerations`,
        `${input.clientName} portfolio holdings`,
      ];
    }
  }

  private static async maybeHydeSnippet(input: {
    meetingTitle: string;
    meeting_type: string;
    clientName: string;
    meeting_objectives: string[];
    organizationId: string;
  }): Promise<string | null> {
    try {
      const result = await callClaudeJSON<{ hypotheticalDocument: string }>(
        `Write a short hypothetical expert note (2-4 sentences) that would be the ideal passage to retrieve for this meeting prep. It is not factual — only for search. Return JSON only with key hypotheticalDocument.`,
        JSON.stringify(input),
        { organizationId: input.organizationId, maxTokens: 400, feature: "MEETING_PREP_HYDE" },
      );
      const snippet = result.hypotheticalDocument?.trim();
      return snippet ? normalizeQuery(snippet).slice(0, 900) : null;
    } catch {
      return null;
    }
  }

  static async generateMeetingBrief(meetingId: string) {
    const loaded = await this.loadEvidence(meetingId);
    const { meeting, householdId, complianceFlags } = loaded;
    const organizationId = meeting.client.organizationId;
    const householdIdentifier = householdId ?? meeting.client.id;

    const advisorContext = MeetingPrepService.buildAdvisorWorkflowInput(loaded, meetingId);

    const classifyContext = {
      organizationId,
      advisor_context: advisorContext,
      meeting: {
        title: meeting.title,
        type: meeting.type,
        rawCalendarContext: meeting.rawCalendarContext ?? null,
      },
      client: {
        name: meeting.client.name,
        riskProfile: meeting.client.riskProfile,
        goals: meeting.client.intelligence?.goals ?? null,
        concerns: meeting.client.intelligence?.concerns ?? null,
      },
      previousMeetings: meeting.client.meetings
        .filter((item) => item.id !== meeting.id)
        .slice(0, 3)
        .map((item) => ({ title: item.title, notes: item.notes })),
    };

    const classify_meeting = await MeetingPrepService.classifyMeetingWorkflow(classifyContext);

    const rewrittenQueries = await this.rewriteRetrievalQueries({
      meetingTitle: meeting.title,
      meeting_type: classify_meeting.meeting_type,
      meeting_objectives: classify_meeting.meeting_objectives,
      clientName: meeting.client.name,
      organizationId,
    });

    const structuredEvidence = this.buildStructuredEvidence(loaded);
    const chunkEvidence: EvidenceItem[] = meeting.client.documents.flatMap((document) =>
      document.chunks.map((chunk) => ({
        id: chunk.id,
        kind: "document_chunk",
        title: document.title ?? document.fileName,
        sectionPath: chunk.sectionPath,
        text: chunk.text,
        effectiveDate: document.effectiveDate?.toISOString() ?? null,
        authorityLevel: document.authorityLevel ?? "medium",
        sourceDocumentId: document.id,
        documentType: document.documentType ?? null,
        sourceName: document.title ?? document.fileName,
      })),
    );

    const retrievalTrace: MeetingPrepRetrievalTrace = {
      normalizedQueries: [],
      hydeSnippet: null,
      lexicalCandidates: 0,
      mergedUniqueBeforeDense: 0,
      afterHybridSort: 0,
      regulatoryCandidates: 0,
    };

    const hydeSnippet = await this.maybeHydeSnippet({
      meetingTitle: meeting.title,
      meeting_type: classify_meeting.meeting_type,
      clientName: meeting.client.name,
      meeting_objectives: classify_meeting.meeting_objectives,
      organizationId,
    });
    retrievalTrace.hydeSnippet = hydeSnippet;

    const retrievalQueries = [...rewrittenQueries];
    if (hydeSnippet) retrievalQueries.push(hydeSnippet);

    let tenantEvidence = (await retrieveTenantDocumentEvidence(
      retrievalQueries,
      {
        organizationId,
        clientId: meeting.client.id,
      },
      retrievalTrace,
      { hydeHypothesis: hydeSnippet, meetingId: meeting.id },
    )) as EvidenceItem[];

    const policyTrace: MeetingPrepRetrievalTrace = {
      normalizedQueries: [],
      hydeSnippet: null,
      lexicalCandidates: 0,
      mergedUniqueBeforeDense: 0,
      afterHybridSort: 0,
      regulatoryCandidates: 0,
    };
    if (/tax|planning|review|portfolio/i.test(classify_meeting.meeting_type)) {
      const policyChunks = (await retrieveTenantDocumentEvidence(
        retrievalQueries.slice(0, 4),
        {
          organizationId,
          clientId: meeting.client.id,
          documentTypes: ["FINANCIAL_PLAN", "TAX_RETURN", "STATEMENT", "INSURANCE", "ESTATE_PLAN", "TRUST_AGREEMENT"],
        },
        policyTrace,
        { hydeHypothesis: hydeSnippet, meetingId: meeting.id },
      )) as EvidenceItem[];
      tenantEvidence = [...tenantEvidence, ...policyChunks];
    }

    if (tenantEvidence.length === 0 && chunkEvidence.length > 0) {
      tenantEvidence = this.keywordSearch(chunkEvidence, rewrittenQueries)
        .slice(0, MEETING_PREP_RETRIEVAL.RERANK_POOL)
        .map((hit) => hit.item);
    }

    const corpusFilters =
      /tax/i.test(classify_meeting.meeting_type) ?
        {
          jurisdictions: ["US"],
          authorityTiers: ["statute", "regulation", "IRS guidance"],
        }
      : /planning/i.test(classify_meeting.meeting_type) ?
        { jurisdictions: ["US"] }
      : undefined;

    const regulatoryEvidence = (await retrieveRegulatoryEvidenceForMeeting(
      normalizeQuery(`${meeting.title} ${rewrittenQueries[0] ?? ""}`),
      classify_meeting.meeting_type,
      organizationId,
      corpusFilters,
      8,
      retrievalTrace,
    )) as EvidenceItem[];
    retrievalTrace.regulatoryCandidates = regulatoryEvidence.length;

    const mergedEvidence = [...structuredEvidence, ...tenantEvidence, ...regulatoryEvidence].filter(
      (item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index,
    );

    const evidencePool = mergedEvidence.slice(0, MEETING_PREP_RETRIEVAL.RERANK_POOL);

    logger.info("meeting_prep.retrieval", {
      meetingId: meeting.id,
      organizationId,
      lexicalCandidates: retrievalTrace.lexicalCandidates,
      mergedUniqueBeforeDense: retrievalTrace.mergedUniqueBeforeDense,
      regulatoryCandidates: retrievalTrace.regulatoryCandidates,
      mergedCount: mergedEvidence.length,
      poolCount: evidencePool.length,
    });

    const rerankedEvidence = await this.rerankEvidence(evidencePool, {
      meetingTitle: meeting.title,
      organizationId,
    });
    const evidence = rerankedEvidence.slice(0, MEETING_PREP_RETRIEVAL.FINAL_CHUNKS);
    const evidenceMap = new Map(evidence.map((item) => [item.id, item]));

    const retrieve_context = await MeetingPrepService.enrichRetrieveContext(evidence, {
      meetingTitle: meeting.title,
      meeting_type: classify_meeting.meeting_type,
      meeting_objectives: classify_meeting.meeting_objectives,
      organizationId,
    });

    const extract_key_facts = await MeetingPrepService.extractKeyFactsWorkflow({
      organizationId,
      classify: classify_meeting,
      retrieve_context,
      advisor_context: advisorContext,
    });

    let draft_brief = await MeetingPrepService.draftBriefWorkflow({
      organizationId,
      meeting_type: classify_meeting.meeting_type,
      extract: extract_key_facts,
      retrieve_context,
      classify: classify_meeting,
    });

    let { verify_claims, verifiedSections } = await MeetingPrepService.runClaimVerificationPhase(draft_brief, evidenceMap, {
      meetingId: meeting.id,
      organizationId,
    });

    const briefForCritique: DraftBriefOutput = { sections: verifiedSections };

    let critique_brief = await MeetingPrepService.critiqueBriefWorkflow({
      organizationId,
      draft: briefForCritique,
      retrieve_context,
      classify: classify_meeting,
    });

    let regenerated = false;
    const verifiedOk = verify_claims.claims.filter((c) => c.verification_status === "verified").length;
    const totalClaims = verify_claims.claims.length;
    if (totalClaims >= 4 && verifiedOk < Math.ceil(totalClaims * 0.55)) {
      regenerated = true;
      draft_brief = await MeetingPrepService.draftBriefWorkflow({
        organizationId,
        meeting_type: classify_meeting.meeting_type,
        extract: extract_key_facts,
        retrieve_context,
        classify: classify_meeting,
        regenerationHint: "strict",
      });
      ({ verify_claims, verifiedSections } = await MeetingPrepService.runClaimVerificationPhase(draft_brief, evidenceMap, {
        meetingId: meeting.id,
        organizationId,
      }));
      critique_brief = await MeetingPrepService.critiqueBriefWorkflow({
        organizationId,
        draft: { sections: verifiedSections },
        retrieve_context,
        classify: classify_meeting,
      });
      logger.warn("meeting_prep.regenerated_draft", {
        meetingId: meeting.id,
        organizationId,
        priorVerifiedRatio: totalClaims ? verifiedOk / totalClaims : 0,
      });
    }

    const deterministicMd = MeetingPrepService.formatFinalAdvisorBriefDeterministic(
      verifiedSections,
      retrieve_context,
      classify_meeting,
    );

    const renderedMarkdown = await MeetingPrepService.formatFinalOutputWorkflow({
      organizationId,
      deterministicMarkdown: deterministicMd,
      verifiedSections,
      retrieve_context,
      classify: classify_meeting,
      critique: critique_brief,
    });

    logger.info("meeting_prep.verification", {
      meetingId: meeting.id,
      organizationId,
      verifiedCount: verify_claims.claims.filter((c) => c.verification_status === "verified").length,
      partialCount: verify_claims.claims.filter((c) => c.verification_status === "partial").length,
      claimCount: verify_claims.claims.length,
      regenerated,
    });

    const complianceScan = await ComplianceService.scanDraft(
      renderedMarkdown,
      organizationId,
      meeting.id,
      "MEETING_BRIEF",
    );

    const complianceReviewFlags = complianceScan.hits.map((hit) => ({
      severity: hit.severity.toLowerCase(),
      message: hit.description,
      citations: [] as string[],
    }));

    const removedUnsupported = verify_claims.claims
      .filter((c) => c.verification_status === "unsupported")
      .map((c) => `[Unsupported — omitted from brief] ${c.claim_text.slice(0, 280)}`);

    const warnings = [
      ...removedUnsupported,
      ...(critique_brief.recommended_fixes ?? []),
      ...(critique_brief.unsupported_claims ?? []),
      ...(complianceScan.requiresReview ? ["Compliance review required before external use."] : []),
    ];

    const verifiedCount = verify_claims.claims.filter((c) => c.verification_status === "verified").length;
    const partialCount = verify_claims.claims.filter((c) => c.verification_status === "partial").length;
    const unsupportedCount = verify_claims.claims.filter((c) => c.verification_status === "unsupported").length;
    const overallConfidence =
      verify_claims.claims.length === 0
        ? "low"
        : unsupportedCount === 0 && warnings.length === 0
          ? "high"
          : verifiedCount >= Math.ceil(verify_claims.claims.length * 0.7)
            ? "medium"
            : "low";

    const verifyByClaimText = new Map(verify_claims.claims.map((c) => [c.claim_text, c]));

    const legacySections = verifiedSections.map((section, index) => ({
      key: `brief_${index}_${section.title.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
      title: section.title,
      content: section.content,
      claims: section.claims.map((claim) => {
        const rec = verifyByClaimText.get(claim.text);
        return {
          text: claim.text,
          citations: claim.source_chunk_ids,
          verified: rec?.verification_status === "verified",
          verification_status: rec?.verification_status,
        };
      }),
    }));

    const schemaJson = {
      meeting_id: meeting.id,
      household_id: householdIdentifier,
      meeting_type: classify_meeting.meeting_type,
      generated_at: new Date().toISOString(),
      sections: legacySections,
      open_questions: extract_key_facts.unresolved_questions,
      workflow: {
        classify_meeting,
        retrieve_context,
        extract_key_facts,
        draft_brief: { sections: verifiedSections },
        critique_brief,
        verify_claims,
        format_final_output: { sections_order: [...FINAL_BRIEF_SECTION_ORDER] },
      },
      rendered_sections: verifiedSections,
      warnings,
      compliance_flags: [
        ...complianceFlags.map((flag) => ({
          severity: flag.severity.toLowerCase(),
          message: flag.description,
          citations: [`flag:${flag.id}`],
        })),
        ...complianceReviewFlags,
      ],
      overall_confidence: overallConfidence,
      evidence: evidence.map((item) => ({
        id: item.id,
        title: item.title,
        sectionPath: item.sectionPath,
        text: item.text,
        effectiveDate: item.effectiveDate,
        authorityLevel: item.authorityLevel,
        kind: item.kind,
        documentType: item.documentType,
        sourceName: item.sourceName,
        retrieval_quality_note: item.retrieval_quality_note ?? undefined,
      })),
    };

    const meetingBrief = await prisma.meetingBrief.create({
      data: {
        organizationId,
        householdId,
        meetingId: meeting.id,
        status: complianceScan.requiresReview ? "REVIEW_REQUIRED" : "COMPLETED",
        schemaJson: schemaJson as unknown as Prisma.InputJsonValue,
        renderedMarkdown,
        overallConfidence: overallConfidence.toUpperCase(),
        pipelineTrace: {
          classify_meeting,
          retrieve_context,
          extract_key_facts,
          draft_brief: draft_brief,
          critique_brief,
          verify_claims,
          rewrittenQueries,
          hydeSnippet,
          retrieval: retrievalTrace,
          evidenceIds: evidence.map((item) => item.id),
          regenerated,
          verification: {
            verifiedCount,
            partialCount,
            unsupportedCount,
            claimCount: verify_claims.claims.length,
          },
          critique: critique_brief,
          complianceScan: {
            riskScore: complianceScan.riskScore,
            requiresReview: complianceScan.requiresReview,
            hitCount: complianceScan.hits.length,
          },
        } as unknown as Prisma.InputJsonValue,
      },
    });

    if (verify_claims.claims.length > 0) {
      await prisma.claimVerification.createMany({
        data: verify_claims.claims.map((claim) => ({
          meetingBriefId: meetingBrief.id,
          claimText: claim.claim_text,
          verified: claim.verification_status === "verified",
          supportingChunkIds: claim.source_chunk_ids,
          failureReason:
            claim.verification_status === "unsupported" ? claim.explanation || "unsupported"
            : claim.verification_status === "partial" ? `partial: ${claim.explanation}`
            : null,
        })),
      });
    }

    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        briefGenerated: true,
        briefText: JSON.stringify({
          ...schemaJson,
          meetingBriefId: meetingBrief.id,
          rendered_markdown: renderedMarkdown,
        }),
      },
    });

    return schemaJson;
  }
}
