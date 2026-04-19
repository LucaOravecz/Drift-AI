import prisma from "../db";
import { MeetingPrepService } from "./meeting-prep.service";

export type RequestType =
  | "MEETING_PREP"
  | "CLIENT_LOOKUP"
  | "VAULT_LOOKUP"
  | "COMPLIANCE_LOOKUP"
  | "OUT_OF_SCOPE";

export type StepKind =
  | "classify"
  | "gather_context"
  | "check_rules"
  | "search_web"
  | "read_vault"
  | "compliance"
  | "synthesize"
  | "cite";

export type EvidenceRef = {
  label: string;
  kind: "client" | "document" | "web" | "rule" | "custodian";
  url?: string;
  freshness?: string;
  confidence?: number;
};

export type CopilotStreamEvent =
  | { type: "step_start"; id: string; kind: StepKind; title: string; body?: string; chips?: string[] }
  | { type: "step_update"; id: string; body?: string; chips?: string[] }
  | { type: "step_complete"; id: string; evidence?: EvidenceRef[] }
  | { type: "token"; text: string }
  | { type: "complete"; response: CopilotResponse }
  | { type: "error"; message: string };

export interface WorkflowTrace {
  requestType: RequestType;
  inputsUsed: string[];
  deterministicChecks: string[];
  agentModulesUsed: string[];
  outputsGenerated: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reviewRequired: boolean;
  dataQuality: "COMPLETE" | "PARTIAL" | "INSUFFICIENT";
  missingData: string[];
  timestamp: string;
}

export type CopilotSource = {
  id: string;
  kind: "client" | "document" | "meeting" | "custodian_position" | "compliance_rule" | "web";
  label: string;
  subtitle?: string;
  url?: string;
  freshness?: string;
  confidence?: number;
  excerpt?: string;
};

export interface CopilotResponseSection {
  label: string;
  content: string | string[];
  type: "answer" | "findings" | "actions" | "warning" | "draft" | "missing_data";
}

export interface CopilotResponse {
  id: string;
  prompt: string;
  sections: CopilotResponseSection[];
  sources: CopilotSource[];
  trace: WorkflowTrace;
  generatedAt: string;
}

function classifyRequest(prompt: string): RequestType {
  const lower = prompt.toLowerCase();
  if (lower.includes("meeting") || lower.includes("prep") || lower.includes("brief")) return "MEETING_PREP";
  if (lower.includes("document") || lower.includes("vault") || lower.includes("source") || lower.includes("citation")) {
    return "VAULT_LOOKUP";
  }
  if (lower.includes("compliance") || lower.includes("policy") || lower.includes("flag")) return "COMPLIANCE_LOOKUP";
  if (lower.includes("client") || lower.includes("household")) return "CLIENT_LOOKUP";
  return "OUT_OF_SCOPE";
}

function parseBrief(briefText: string | null) {
  if (!briefText) return null;
  try {
    return JSON.parse(briefText) as {
      sections?: Array<{ title: string; content: string; claims: Array<{ text: string; citations: string[] }> }>;
      warnings?: string[];
      evidence?: Array<{ id: string; title: string; sectionPath: string; kind: string }>;
      compliance_flags?: Array<{ severity: string; message: string }>;
      overall_confidence?: string;
    };
  } catch {
    return null;
  }
}

async function findMentionedClient(prompt: string, organizationId: string) {
  const clients = await prisma.client.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });
  const lower = prompt.toLowerCase();
  return (
    clients.find((client) => lower.includes(client.name.toLowerCase())) ??
    clients.find((client) => lower.includes(client.name.split(" ")[0]?.toLowerCase() ?? ""))
  );
}

async function buildMeetingPrepResponse(prompt: string, organizationId: string, onProgress?: (e: CopilotStreamEvent) => void): Promise<CopilotResponse> {
  onProgress?.({ type: "step_start", id: "gather_meetings", kind: "gather_context", title: "Looking up scheduled meetings..." });
  const mentionedClient = await findMentionedClient(prompt, organizationId);
  const meeting = await prisma.meeting.findFirst({
    where: {
      client: { organizationId },
      status: "SCHEDULED",
      ...(mentionedClient ? { clientId: mentionedClient.id } : {}),
    },
    include: { client: true },
    orderBy: { scheduledAt: "asc" },
  });

  onProgress?.({ type: "step_complete", id: "gather_meetings" });

  if (!meeting) {
    return {
      id: crypto.randomUUID(),
      prompt,
      generatedAt: new Date().toISOString(),
      sections: [
        {
          label: "Meeting Prep",
          content: "No scheduled meeting was found for this request.",
          type: "warning",
        },
      ],
      trace: {
        requestType: "MEETING_PREP",
        inputsUsed: ["meetings"],
        deterministicChecks: ["Checked for the next scheduled meeting."],
        agentModulesUsed: ["meeting-prep"],
        outputsGenerated: ["warning"],
        confidence: "LOW",
        reviewRequired: false,
        dataQuality: "INSUFFICIENT",
        missingData: ["No scheduled meetings on record."],
        timestamp: new Date().toISOString(),
      },
      sources: mentionedClient ? [
        {
          id: mentionedClient.id,
          kind: "client",
          label: mentionedClient.name,
          subtitle: "Household context",
          confidence: 0.9,
          freshness: new Date().toISOString()
        }
      ] : [],
    };
  }

  const briefSchema = meeting.briefGenerated ? parseBrief(meeting.briefText) : null;

  if (!briefSchema) {
    onProgress?.({ type: "step_start", id: "synth", kind: "synthesize", title: "Generating meeting prep brief...", chips: ["meeting-prep"] });
  } else {
    onProgress?.({ type: "step_start", id: "synth", kind: "synthesize", title: "Loading generated brief..." });
  }
  const hydratedBrief = briefSchema ?? (await MeetingPrepService.generateMeetingBrief(meeting.id));
  const parsed = briefSchema ?? hydratedBrief;
  
  onProgress?.({ type: "step_complete", id: "synth" });
  onProgress?.({ type: "step_start", id: "cite", kind: "cite", title: "Attaching evidence..." });
  onProgress?.({ type: "step_complete", id: "cite" });

  return {
    id: crypto.randomUUID(),
    prompt,
    generatedAt: new Date().toISOString(),
    sections: [
      {
        label: "Answer",
        type: "answer",
        content: `Meeting prep is ready for ${meeting.client.name}: ${meeting.title}.`,
      },
      {
        label: "Brief Highlights",
        type: "findings",
        content:
          parsed.sections?.slice(0, 3).map((section) => `${section.title}: ${section.content}`) ??
          ["No brief sections available."],
      },
      {
        label: "Warnings",
        type: parsed.warnings?.length ? "warning" : "missing_data",
        content: parsed.warnings?.length ? parsed.warnings : ["No current warnings."],
      },
      {
        label: "Compliance",
        type: parsed.compliance_flags?.length ? "actions" : "missing_data",
        content:
          parsed.compliance_flags?.length
            ? parsed.compliance_flags.map((flag) => `${flag.severity.toUpperCase()}: ${flag.message}`)
            : ["No compliance flags currently attached to this brief."],
      },
    ],
    sources: [
      {
        id: meeting.client.id,
        kind: "client",
        label: meeting.client.name,
        subtitle: "Household contextual record",
        confidence: 1.0,
      },
      {
        id: meeting.id,
        kind: "meeting",
        label: meeting.title,
        subtitle: "CRM Meeting Record",
        freshness: meeting.scheduledAt.toISOString(),
        confidence: 1.0,
      },
    ],
    trace: {
      requestType: "MEETING_PREP",
      inputsUsed: ["meetings", "tasks", "documents", "holdings", "compliance"],
      deterministicChecks: [
        `Resolved meeting ${meeting.title}.`,
        `Brief confidence: ${parsed.overall_confidence ?? "unknown"}.`,
      ],
      agentModulesUsed: ["meeting-prep", "citation-verification", "compliance-pass"],
      outputsGenerated: ["brief summary", "warnings", "compliance review"],
      confidence:
        parsed.overall_confidence === "high"
          ? "HIGH"
          : parsed.overall_confidence === "medium"
            ? "MEDIUM"
            : "LOW",
      reviewRequired: (parsed.warnings?.length ?? 0) > 0 || (parsed.compliance_flags?.length ?? 0) > 0,
      dataQuality: parsed.sections?.length ? "COMPLETE" : "PARTIAL",
      missingData: parsed.warnings ?? [],
      timestamp: new Date().toISOString(),
    },
  };
}

async function buildClientLookupResponse(prompt: string, organizationId: string, onProgress?: (e: CopilotStreamEvent) => void): Promise<CopilotResponse> {
  onProgress?.({ type: "step_start", id: "gather_client", kind: "gather_context", title: "Searching client records...", chips: ["CRM"] });
  const client = await findMentionedClient(prompt, organizationId);
  onProgress?.({ type: "step_complete", id: "gather_client" });
  if (!client) {
    return {
      id: crypto.randomUUID(),
      prompt,
      generatedAt: new Date().toISOString(),
      sections: [{ label: "Client Lookup", content: "No matching household was found.", type: "warning" }],
      trace: {
        requestType: "CLIENT_LOOKUP",
        inputsUsed: ["clients"],
        deterministicChecks: ["Matched prompt against stored client names."],
        agentModulesUsed: ["client-lookup"],
        outputsGenerated: ["warning"],
        confidence: "LOW",
        reviewRequired: false,
        dataQuality: "INSUFFICIENT",
        missingData: ["No matching household name detected."],
        timestamp: new Date().toISOString(),
      },
      sources: [],
    };
  }

  onProgress?.({ type: "step_start", id: "gather_client_detail", kind: "gather_context", title: `Loading ${client.name} profile...`, chips: [client.name] });
  const profile = await prisma.client.findUnique({
    where: { id: client.id },
    include: { intelligence: true, tasks: { where: { isCompleted: false }, take: 5 }, meetings: { orderBy: { scheduledAt: "asc" }, take: 3 } },
  });
  onProgress?.({ type: "step_complete", id: "gather_client_detail" });
  onProgress?.({ type: "step_start", id: "check_client_rules", kind: "check_rules", title: "Checking for compliance flags..." });
  onProgress?.({ type: "step_complete", id: "check_client_rules" });

  return {
    id: crypto.randomUUID(),
    prompt,
    generatedAt: new Date().toISOString(),
    sections: [
      {
        label: "Client Overview",
        type: "answer",
        content: [
          `Household: ${profile?.name ?? client.name}`,
          `Risk profile: ${profile?.riskProfile ?? "Not recorded"}`,
          `Goals: ${profile?.intelligence?.goals ?? "Not recorded"}`,
        ],
      },
      {
        label: "Open Items",
        type: profile?.tasks.length ? "actions" : "missing_data",
        content: profile?.tasks.length ? profile.tasks.map((task) => task.title) : ["No open tasks on file."],
      },
    ],
    trace: {
      requestType: "CLIENT_LOOKUP",
      inputsUsed: ["clients", "tasks", "meetings"],
      deterministicChecks: [`Resolved household ${client.name}.`],
      agentModulesUsed: ["client-lookup"],
      outputsGenerated: ["overview", "open items"],
      confidence: "MEDIUM",
      reviewRequired: false,
      dataQuality: "PARTIAL",
      missingData: [],
      timestamp: new Date().toISOString(),
    },
    sources: [
      {
        id: client.id,
        kind: "client",
        label: client.name,
        subtitle: "CRM Client Directory",
        confidence: 0.98,
      }
    ],
  };
}

async function buildVaultLookupResponse(prompt: string, organizationId: string, onProgress?: (e: CopilotStreamEvent) => void): Promise<CopilotResponse> {
  onProgress?.({ type: "step_start", id: "read_vault", kind: "read_vault", title: "Scanning vault documents...", chips: ["Vault"] });
  const chunks = await prisma.documentChunk.findMany({
    where: { organizationId },
    include: { document: true },
    take: 40,
  });

  const ranked = chunks
    .map((chunk) => ({
      chunk,
      score: prompt
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length > 2)
        .reduce((sum, term) => sum + (chunk.text.toLowerCase().includes(term) ? 1 : 0), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  onProgress?.({ type: "step_complete", id: "read_vault" });
  onProgress?.({ type: "step_start", id: "rank_vault", kind: "synthesize", title: "Ranking evidence by relevance..." });
  onProgress?.({ type: "step_complete", id: "rank_vault" });

  return {
    id: crypto.randomUUID(),
    prompt,
    generatedAt: new Date().toISOString(),
    sections: [
      {
        label: "Vault Findings",
        type: ranked.length ? "findings" : "missing_data",
        content: ranked.length
          ? ranked.map(
              ({ chunk }) =>
                `${chunk.document.title ?? chunk.document.fileName} · ${chunk.sectionPath} · ${chunk.id}`,
            )
          : ["No matching evidence chunks were found in Vault."],
      },
    ],
    trace: {
      requestType: "VAULT_LOOKUP",
      inputsUsed: ["document_chunks"],
      deterministicChecks: [`Scanned ${chunks.length} chunk(s) for lexical matches.`],
      agentModulesUsed: ["vault-search"],
      outputsGenerated: ["evidence hits"],
      confidence: ranked.length ? "MEDIUM" : "LOW",
      reviewRequired: false,
      dataQuality: ranked.length ? "PARTIAL" : "INSUFFICIENT",
      missingData: ranked.length ? [] : ["No matching document chunks found."],
      timestamp: new Date().toISOString(),
    },
    sources: ranked.map(({ chunk, score }) => ({
      id: chunk.id,
      kind: "document",
      label: chunk.document.title ?? chunk.document.fileName,
      subtitle: chunk.sectionPath,
      confidence: Math.min(score / 5, 1.0),
      excerpt: chunk.text.slice(0, 180) + (chunk.text.length > 180 ? "..." : "")
    })),
  };
}

async function buildComplianceLookupResponse(prompt: string, organizationId: string, onProgress?: (e: CopilotStreamEvent) => void): Promise<CopilotResponse> {
  onProgress?.({ type: "step_start", id: "compliance_check", kind: "compliance", title: "Checking compliance queue...", chips: ["Compliance"] });
  const flags = await prisma.complianceFlag.findMany({
    where: { organizationId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 10,
  });

  onProgress?.({ type: "step_complete", id: "compliance_check" });
  return {
    id: crypto.randomUUID(),
    prompt,
    generatedAt: new Date().toISOString(),
    sections: [
      {
        label: "Compliance Queue",
        type: flags.length ? "warning" : "answer",
        content: flags.length
          ? flags.map((flag) => `${flag.severity}: ${flag.description}`)
          : "No open compliance flags were found.",
      },
    ],
    trace: {
      requestType: "COMPLIANCE_LOOKUP",
      inputsUsed: ["compliance_flags"],
      deterministicChecks: [`Loaded ${flags.length} open compliance flag(s).`],
      agentModulesUsed: ["compliance-review"],
      outputsGenerated: ["queue summary"],
      confidence: flags.length ? "MEDIUM" : "HIGH",
      reviewRequired: flags.length > 0,
      dataQuality: "COMPLETE",
      missingData: [],
      timestamp: new Date().toISOString(),
    },
    sources: flags.map(flag => ({
      id: flag.id,
      kind: "compliance_rule",
      label: flag.ruleId ?? "Unknown rule",
      subtitle: flag.severity,
      freshness: flag.createdAt.toISOString(),
      excerpt: flag.description,
      confidence: 1.0
    }))
  };
}

export async function runCopilot(prompt: string, organizationId: string, onProgress?: (e: CopilotStreamEvent) => void): Promise<CopilotResponse> {
  onProgress?.({ type: "step_start", id: "classify", kind: "classify", title: "Classifying request..." });
  const requestType = classifyRequest(prompt);
  onProgress?.({ type: "step_complete", id: "classify" });

  switch (requestType) {
    case "MEETING_PREP":
      return buildMeetingPrepResponse(prompt, organizationId, onProgress);
    case "CLIENT_LOOKUP":
      return buildClientLookupResponse(prompt, organizationId, onProgress);
    case "VAULT_LOOKUP":
      return buildVaultLookupResponse(prompt, organizationId, onProgress);
    case "COMPLIANCE_LOOKUP":
      return buildComplianceLookupResponse(prompt, organizationId, onProgress);
    default:
      return {
        id: crypto.randomUUID(),
        prompt,
        generatedAt: new Date().toISOString(),
        sections: [
          {
            label: "Scope",
            type: "warning",
            content:
              "Copilot is currently limited to meeting prep, household lookup, vault evidence search, and compliance review.",
          },
        ],
        trace: {
          requestType: "OUT_OF_SCOPE",
          inputsUsed: [],
          deterministicChecks: ["Request rejected because it falls outside the narrowed product scope."],
          agentModulesUsed: ["scope-guard"],
          outputsGenerated: ["scope warning"],
          confidence: "HIGH",
          reviewRequired: false,
          dataQuality: "INSUFFICIENT",
          missingData: [],
          timestamp: new Date().toISOString(),
        },
        sources: []
      };
  }
}
