/**
 * Phase 2 meeting-prep workflow — structured step outputs (advisor brief).
 */

export interface ClassifyMeetingOutput {
  meeting_type: string;
  meeting_objectives: string[];
  required_sections: string[];
  missing_inputs: string[];
}

export interface RetrievedChunk {
  chunk_id: string;
  document_id: string;
  document_type: string;
  source_name: string;
  authority_tier: string;
  effective_date: string;
  relevance_reason: string;
  text: string;
  /** Set by retrieval when material is stale, low authority, or secondary/summary */
  retrieval_quality_note?: string;
}

export interface RetrieveContextOutput {
  retrieved_chunks: RetrievedChunk[];
}

export interface ExtractKeyFactsOutput {
  client_facts: string[];
  open_action_items: string[];
  portfolio_flags: string[];
  tax_flags: string[];
  compliance_flags: string[];
  opportunities_to_discuss: string[];
  unresolved_questions: string[];
}

export interface DraftBriefClaim {
  text: string;
  source_chunk_ids: string[];
}

export interface DraftBriefSection {
  title: string;
  content: string;
  claims: DraftBriefClaim[];
}

export interface DraftBriefOutput {
  sections: DraftBriefSection[];
}

export interface CritiqueBriefOutput {
  missing_sections: string[];
  generic_sections: string[];
  unsupported_claims: string[];
  recommended_fixes: string[];
}

export type VerificationStatus = "verified" | "partial" | "unsupported";

/** Phase 4 internal verification record (persisted in workflow + claimVerification.failureReason). */
export interface VerifiedClaimRecord {
  claim_text: string;
  claim_type: string;
  section_title?: string;
  source_chunk_ids: string[];
  calculation_inputs: string[];
  verification_status: VerificationStatus;
  explanation: string;
}

export interface VerifyClaimsOutput {
  claims: VerifiedClaimRecord[];
}

/** Canonical final brief sections (advisor-facing). Sources appended after LLM/deterministic body. */
export const FINAL_BRIEF_SECTION_ORDER = [
  "Meeting purpose",
  "Client snapshot",
  "Open action items",
  "Portfolio / planning flags",
  "Compliance or policy flags",
  "Discussion opportunities",
  "Unresolved questions",
  "Sources / citations",
] as const;
