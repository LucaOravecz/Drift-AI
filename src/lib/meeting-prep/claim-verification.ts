/**
 * Phase 4 — Claim verification layer: atomic claims, semantic types, evidence/calc mapping, status rules.
 */

import "server-only";

import { logger } from "@/lib/logger";
import { callClaudeJSON } from "@/lib/services/ai.service";
import type { DraftBriefClaim, DraftBriefOutput, DraftBriefSection } from "@/lib/meeting-prep/workflow-schemas";
import type { VerificationStatus } from "@/lib/meeting-prep/workflow-schemas";

export type ClaimSemanticType =
  | "date"
  | "dollar_amount"
  | "percentage"
  | "client_fact"
  | "compliance_statement"
  | "portfolio_statement"
  | "action_item"
  | "inference";

export interface EvidenceLike {
  id: string;
  kind: string;
  text: string;
  authorityLevel?: string | null;
}

/** Internal claim record after verification (Phase 4 schema). */
export interface VerifiedInternalClaim {
  claim_text: string;
  /** Semantic classification */
  claim_type: ClaimSemanticType | string;
  section_title: string;
  source_chunk_ids: string[];
  /** Deterministic lineage, e.g. extracted figures or calc keys referenced */
  calculation_inputs: string[];
  verification_status: VerificationStatus;
  explanation: string;
}

export interface AtomizedClaimRow {
  claim_text: string;
  section_title: string;
  source_chunk_ids: string[];
  claim_type: ClaimSemanticType | string;
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeMoneyFromText(text: string): string[] {
  const matches = text.match(/\$[\d,]+(?:\.\d{2})?|\d[\d,]*(?:\.\d{2})?\s*(?:million|mm|bn|k)\b|\d[\d,]*(?:\.\d{2})?%/gi) ?? [];
  const digits = text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  return [...matches.map((m) => m.replace(/\s+/g, "")), ...digits.map((d) => d.replace(/,/g, ""))];
}

function extractPercentages(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = Number.parseFloat(m[1]!);
    if (!Number.isNaN(v)) out.push(v);
  }
  return out;
}

function textualOverlapStrength(claim: string, evidenceBody: string): number {
  const claimTerms = normalizeText(claim)
    .split(" ")
    .filter((t) => t.length > 2);
  if (claimTerms.length === 0) return 0;
  const hay = normalizeText(evidenceBody);
  const hits = claimTerms.filter((t) => hay.includes(t)).length;
  return hits / claimTerms.length;
}

function heuristicClassifyClaim(text: string): ClaimSemanticType {
  const lower = text.toLowerCase();
  if (/\d{1,2}\/\d{1,2}\/\d{2,4}|\b20\d{2}\b|\bjanuary\b|\bq\d\b|\bfy\d{2}\b/.test(lower)) return "date";
  if (/\$\s*[\d,]+|[\d,]+\s*(million|mm|bn|thousand|k)\b/i.test(text)) return "dollar_amount";
  if (/\d+(?:\.\d+)?\s*%/.test(text)) return "percentage";
  if (/\b(must|required|restricted|policy|reg\s|finra|sec|compliance|fiduciary|breach)\b/i.test(lower)) {
    return "compliance_statement";
  }
  if (/\b(holding|portfolio|equity|fixed income|allocation|weight|market value|symbol|ticker)\b/i.test(lower)) {
    return "portfolio_statement";
  }
  if (/\b(action|follow\s*up|follow-up|due|complete|schedule|send|review task)\b/i.test(lower)) {
    return "action_item";
  }
  if (/\b(likely|appears|suggest|implies|may|could|infer|probably)\b/i.test(lower)) return "inference";
  return "client_fact";
}

/** Step 4a — Parse draft into atomic classified claims (LLM + heuristic fallback). */
export async function atomizeDraftClaims(
  draft: DraftBriefOutput,
  organizationId: string,
): Promise<AtomizedClaimRow[]> {
  const heuristicAtomize = (): AtomizedClaimRow[] => {
    const rows: AtomizedClaimRow[] = [];
    for (const section of draft.sections) {
      const inheritedIds =
        section.claims.flatMap((c) => c.source_chunk_ids).filter(Boolean);
      const uniq = [...new Set(inheritedIds)];
      const explicit = section.claims.map((c) => ({
        claim_text: c.text.trim(),
        section_title: section.title,
        source_chunk_ids: c.source_chunk_ids.length ? c.source_chunk_ids : uniq,
        claim_type: heuristicClassifyClaim(c.text),
      }));
      rows.push(...explicit);

      const sentences = section.content
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 15 && !s.includes("No substantive information"));
      for (const sentence of sentences) {
        if (rows.some((r) => normalizeText(r.claim_text) === normalizeText(sentence))) continue;
        rows.push({
          claim_text: sentence,
          section_title: section.title,
          source_chunk_ids: uniq,
          claim_type: heuristicClassifyClaim(sentence),
        });
      }
    }
    return rows;
  };

  try {
    const parsed = await callClaudeJSON<{
      atomic_claims: Array<{
        claim_text: string;
        section_title: string;
        source_chunk_ids: string[];
        claim_type: ClaimSemanticType | string;
      }>;
    }>(
      `You split a meeting prep draft into atomic, standalone factual claims.

Rules:
1. One claim per bullet — short declarative sentences.
2. Assign claim_type exactly one of: date, dollar_amount, percentage, client_fact, compliance_statement, portfolio_statement, action_item, inference.
3. Copy source_chunk_ids from the originating draft claims when applicable; if uncertain, use [].
4. Do not invent facts or chunk ids.

Return JSON only: { "atomic_claims": [ ... ] }`,
      JSON.stringify({ draft }),
      { organizationId, maxTokens: 4500, feature: "MEETING_PREP_EXTRACT" },
    );

    const list = parsed.atomic_claims ?? [];
    if (list.length === 0) return heuristicAtomize();
    return list.map((row) => ({
      claim_text: row.claim_text.trim(),
      section_title: row.section_title,
      source_chunk_ids: row.source_chunk_ids ?? [],
      claim_type: row.claim_type || heuristicClassifyClaim(row.claim_text),
    }));
  } catch {
    return heuristicAtomize();
  }
}

const GROUNDED_KINDS = new Set([
  "deterministic_calculation",
  "holding",
  "task",
  "tax_insight",
  "compliance_flag",
  "client_profile",
  "meeting_note",
]);

function extractCalculationInputs(
  claimType: string,
  claimText: string,
  cited: EvidenceLike[],
): string[] {
  const inputs: string[] = [];
  if (cited.some((c) => c.kind === "deterministic_calculation")) {
    inputs.push("calc:portfolio_summary");
    const mv = normalizeMoneyFromText(claimText);
    inputs.push(...mv.slice(0, 4).map((v) => `figure:${v}`));
  }
  for (const item of cited) {
    if (item.kind === "holding") inputs.push(`holding:${item.id}`);
    if (item.kind === "task") inputs.push(`task:${item.id}`);
  }
  return [...new Set(inputs)].slice(0, 12);
}

/** Step 4b — Verify each atomic claim against evidence map and deterministic sources. */
export function verifyAtomicClaimsAgainstEvidence(
  rows: AtomizedClaimRow[],
  evidenceMap: Map<string, EvidenceLike>,
  ctx?: { meetingId?: string; organizationId?: string },
): VerifiedInternalClaim[] {
  const results: VerifiedInternalClaim[] = [];

  for (const row of rows) {
    const cited =
      row.source_chunk_ids.map((id) => evidenceMap.get(id)).filter(Boolean) as EvidenceLike[];

    let verification_status: VerificationStatus = "unsupported";
    let explanation = "";
    const calculation_inputs = extractCalculationInputs(String(row.claim_type), row.claim_text, cited);

    const claimTerms = normalizeText(row.claim_text)
      .split(" ")
      .filter((t) => t.length > 2);
    const overlap = (body: string) => textualOverlapStrength(row.claim_text, body);

    if (cited.length === 0) {
      explanation = "No source_chunk_ids resolved to retrieved evidence.";
      logVerificationFailure(row, verification_status, explanation, ctx);
      results.push({
        claim_text: row.claim_text,
        claim_type: row.claim_type,
        section_title: row.section_title,
        source_chunk_ids: row.source_chunk_ids,
        calculation_inputs,
        verification_status,
        explanation,
      });
      continue;
    }

    if (cited.some((c) => c.kind === "deterministic_calculation")) {
      const dollarMatch =
        row.claim_type === "dollar_amount" ?
          cited.some((c) => {
            const claimNums = normalizeMoneyFromText(row.claim_text);
            const evNums = normalizeMoneyFromText(c.text);
            return claimNums.some((n) => evNums.some((e) => e.includes(n) || n.includes(e)));
          })
        : true;
      verification_status = dollarMatch ? "verified" : "partial";
      explanation = dollarMatch ? "Supported by deterministic calculation chunk." : "Amount wording may not exactly match calculation line.";
      if (verification_status !== "verified") logVerificationFailure(row, verification_status, explanation, ctx);
      results.push({
        claim_text: row.claim_text,
        claim_type: row.claim_type,
        section_title: row.section_title,
        source_chunk_ids: row.source_chunk_ids,
        calculation_inputs,
        verification_status,
        explanation,
      });
      continue;
    }

    if (cited.some((c) => GROUNDED_KINDS.has(c.kind))) {
      const bestOverlap = Math.max(...cited.map((c) => overlap(c.text)));
      if (row.claim_type === "inference" && bestOverlap < 0.45) {
        verification_status = "partial";
        explanation = "Inference claim: directional support from structured source but wording is not tightly bound to evidence.";
        logVerificationFailure(row, verification_status, explanation, ctx);
      } else if (bestOverlap >= 0.35) {
        verification_status = "verified";
        explanation = "Supported by cited CRM/system or client record chunk.";
      } else {
        verification_status = "partial";
        explanation = "Citation present but lexical overlap with evidence text is weak.";
        logVerificationFailure(row, verification_status, explanation, ctx);
      }
      results.push({
        claim_text: row.claim_text,
        claim_type: row.claim_type,
        section_title: row.section_title,
        source_chunk_ids: row.source_chunk_ids,
        calculation_inputs,
        verification_status,
        explanation,
      });
      continue;
    }

    if (cited.some((c) => c.kind === "regulatory_corpus")) {
      const best = Math.max(...cited.map((c) => overlap(c.text)));
      if (best >= 0.4) {
        verification_status = "verified";
        explanation = "Supported by cited regulatory excerpt.";
      } else if (best >= 0.2) {
        verification_status = "partial";
        explanation = "Regulatory citation directionally relevant; phrasing does not tightly match excerpt.";
        logVerificationFailure(row, verification_status, explanation, ctx);
      } else {
        verification_status = "unsupported";
        explanation = "Claim not adequately supported by cited regulatory text.";
        logVerificationFailure(row, verification_status, explanation, ctx);
      }
      results.push({
        claim_text: row.claim_text,
        claim_type: row.claim_type,
        section_title: row.section_title,
        source_chunk_ids: row.source_chunk_ids,
        calculation_inputs,
        verification_status,
        explanation,
      });
      continue;
    }

    /* document_chunk and other vault text */
    const maxO = Math.max(...cited.map((c) => overlap(c.text)));
    if (row.claim_type === "percentage") {
      const claimPcts = extractPercentages(row.claim_text);
      const evPcts = cited.flatMap((c) => extractPercentages(c.text));
      const pctMatch =
        claimPcts.length === 0 || evPcts.some((p) => claimPcts.some((q) => Math.abs(p - q) < 0.15));
      verification_status =
        pctMatch && maxO >= 0.25 ? "verified" : pctMatch ? "partial" : maxO >= 0.35 ? "partial" : "unsupported";
      explanation =
        verification_status === "verified" ? "Percentage aligns with cited document text."
        : "Percentage or context only partially aligned with cited text.";
      if (verification_status !== "verified") logVerificationFailure(row, verification_status, explanation, ctx);
    } else if (row.claim_type === "date") {
      const dateStrs = row.claim_text.match(/\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}/g) ?? [];
      const hit = cited.some((c) => dateStrs.some((d) => c.text.includes(d)));
      verification_status =
        hit && maxO >= 0.2 ? "verified"
        : hit ? "partial"
        : maxO >= 0.35 ? "partial"
        : "unsupported";
      explanation =
        verification_status === "verified" ? "Date reference found in cited source."
        : "Date claim not clearly anchored in cited passage.";
      if (verification_status !== "verified") logVerificationFailure(row, verification_status, explanation, ctx);
    } else {
      if (maxO >= 0.45) {
        verification_status = "verified";
        explanation = "Strong overlap with cited vault/document text.";
      } else if (maxO >= 0.22) {
        verification_status = "partial";
        explanation = "Directional support from vault text; incomplete or ambiguous match.";
        logVerificationFailure(row, verification_status, explanation, ctx);
      } else {
        verification_status = "unsupported";
        explanation = "Insufficient overlap with cited document text.";
        logVerificationFailure(row, verification_status, explanation, ctx);
      }
    }

    results.push({
      claim_text: row.claim_text,
      claim_type: row.claim_type,
      section_title: row.section_title,
      source_chunk_ids: row.source_chunk_ids,
      calculation_inputs,
      verification_status,
      explanation,
    });
  }

  return results;
}

/** Reassemble draft sections from verified atomic claims (partial labeling, unsupported omitted). */
export function buildVerifiedDraftSections(
  canonicalTitles: readonly string[],
  verified: VerifiedInternalClaim[],
): DraftBriefSection[] {
  const normalize = (raw: string) =>
    canonicalTitles.find((c) => c.toLowerCase().trim() === raw.toLowerCase().trim()) ?? raw.trim();

  const grouped = new Map<string, VerifiedInternalClaim[]>();
  for (const v of verified) {
    const key = normalize(v.section_title);
    const list = grouped.get(key) ?? [];
    list.push(v);
    grouped.set(key, list);
  }

  return canonicalTitles.map((title) => {
    const list = grouped.get(title) ?? [];
    const retained = list.filter((c) => c.verification_status !== "unsupported");

    const lines = retained.map((c) =>
      c.verification_status === "partial" ? `**[Partial verification]** ${c.claim_text}` : c.claim_text,
    );

    const content =
      retained.length > 0 ? lines.join("\n\n") : `_No substantive verified content for ${title}._`;

    const claimsOut: DraftBriefClaim[] = retained.map((c) => ({
      text: c.claim_text,
      source_chunk_ids: c.source_chunk_ids,
    }));

    return { title, content, claims: claimsOut };
  });
}

function logVerificationFailure(
  row: AtomizedClaimRow,
  status: VerificationStatus,
  explanation: string,
  ctx?: { meetingId?: string; organizationId?: string },
) {
  if (status === "verified") return;
  logger.warn("meeting_prep.claim_verification.failed", {
    event: "claim_verification_failed",
    meetingId: ctx?.meetingId,
    organizationId: ctx?.organizationId,
    section_title: row.section_title,
    claim_type: row.claim_type,
    claim_text: row.claim_text.slice(0, 500),
    verification_status: status,
    explanation,
    source_chunk_ids: row.source_chunk_ids,
  });
}
