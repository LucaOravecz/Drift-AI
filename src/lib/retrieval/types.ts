/** Shared retrieval contracts (tenant vault + meeting prep evidence rows). */

export interface VaultChunkStoredMetadata {
  chunk_id?: string;
  document_id: string;
  tenant_id: string;
  client_id?: string | null;
  source_name: string;
  source_type: string;
  document_type: string | null;
  authority_tier: string;
  jurisdiction?: string | null;
  effective_date?: string | null;
  publication_date?: string | null;
  /** ISO — chunk row createdAt mirror for consumers */
  created_at?: string;
  source_url?: string | null;
  title?: string | null;
  headings: string[];
  tags?: string[];
  boundary_type?: "title" | "section" | "subsection" | "paragraph" | "clause";
}

export interface TenantEvidenceLike {
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
  /** Present when authority is dated, secondary, or summary-heavy */
  retrieval_quality_note?: string | null;
}

export interface RetrievalCandidateScore {
  chunk_id: string;
  bm25_lexical?: number | null;
  dense_similarity?: number | null;
  hybrid_before_boost?: number | null;
  tenant_client_boost?: number | null;
  freshness_boost?: number | null;
  conflict_penalty?: number | null;
  final_blend_score?: number | null;
}

export interface RetrievalRunLog {
  raw_queries: string[];
  normalized_queries: string[];
  expanded_hypothesis_present: boolean;
  bm25_candidate_ids: string[];
  dense_candidate_ids: string[];
  merged_unique_ids: string[];
  rerank_ordered_ids?: string[];
  rerank_scores?: RetrievalCandidateScore[];
  final_selected_ids: string[];
  staleness_warnings: string[];
  /** Which retrieval implementation produced this log */
  pipeline?: "tenant_vault" | "regulatory_corpus";
}
