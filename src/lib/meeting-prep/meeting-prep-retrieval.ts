import "server-only";

import { logger } from "@/lib/logger";
import { normalizeRetrievalQuery } from "@/lib/retrieval/query-normalize";
import { runTenantRetrieval, type TenantRetrievalFilters } from "@/lib/retrieval/tenant-retrieval-engine";
import type { RetrievalRunLog, TenantEvidenceLike } from "@/lib/retrieval/types";
import type { MeetingPrepRetrievalTrace } from "@/lib/meeting-prep/meeting-prep-trace";
import {
  RegulatoryCorpusService,
  type CorpusRetrievalFilters,
} from "@/lib/services/regulatory-corpus.service";

export type { MeetingPrepRetrievalTrace } from "@/lib/meeting-prep/meeting-prep-trace";

export type { TenantRetrievalFilters };
export type MeetingPrepEvidenceLike = TenantEvidenceLike;
export { normalizeRetrievalQuery as normalizeQuery } from "@/lib/retrieval/query-normalize";

export const MEETING_PREP_RETRIEVAL = {
  RERANK_POOL: 45,
  FINAL_CHUNKS: 10,
  LEXICAL_PER_QUERY: 55,
} as const;

/**
 * Phase 3 tenant retrieval (BM25 ∪ dense, merge, blend) with full pipeline logging.
 * `trace` is updated with `retrieval_run_log` and `normalizedQueries`.
 */
export async function retrieveTenantDocumentEvidence(
  queries: string[],
  filters: TenantRetrievalFilters,
  trace: MeetingPrepRetrievalTrace,
  options?: { hydeHypothesis?: string | null; meetingId?: string },
): Promise<MeetingPrepEvidenceLike[]> {
  const { hits, log } = await runTenantRetrieval({
    rawQueries: queries,
    filters,
    expandedHypothesis: options?.hydeHypothesis ?? null,
    meetingId: options?.meetingId,
  });

  trace.normalizedQueries = log.normalized_queries;
  trace.hydeSnippet = options?.hydeHypothesis ?? trace.hydeSnippet;
  trace.retrieval_run_log = log;
  trace.lexicalCandidates = log.bm25_candidate_ids.length;
  trace.mergedUniqueBeforeDense = log.merged_unique_ids.length;
  trace.afterHybridSort = log.merged_unique_ids.length;
  return hits;
}

export async function retrieveRegulatoryEvidenceForMeeting(
  primaryQuery: string,
  meetingType: string,
  organizationId: string,
  filters: CorpusRetrievalFilters | undefined,
  limit: number,
  trace?: MeetingPrepRetrievalTrace | null,
): Promise<MeetingPrepEvidenceLike[]> {
  const taxLike = /tax|planning/i.test(meetingType);
  if (!taxLike) return [];

  const q = normalizeRetrievalQuery(primaryQuery);
  if (!q) return [];

  const rows = await RegulatoryCorpusService.retrieve(q, limit, filters);

  const ids = rows.map((r) => r.id);
  const log: RetrievalRunLog = {
    raw_queries: [primaryQuery],
    normalized_queries: [q],
    expanded_hypothesis_present: false,
    bm25_candidate_ids: ids,
    dense_candidate_ids: ids,
    merged_unique_ids: ids,
    final_selected_ids: ids,
    staleness_warnings: [],
    pipeline: "regulatory_corpus",
  };

  logger.info("retrieval.regulatory.complete", {
    organizationId,
    pipeline: log.pipeline,
    raw_queries: log.raw_queries,
    normalized_queries: log.normalized_queries,
    candidate_count: ids.length,
    final_selected_ids: log.final_selected_ids,
  });

  if (trace) {
    trace.regulatory_retrieval_log = log;
  }

  return rows.map((row) => ({
    id: `corpus:${row.id}`,
    kind: "regulatory_corpus",
    title: row.headingTitle ?? row.metadata.citation ?? row.metadata.source_name ?? "Regulatory source",
    sectionPath: row.metadata.document_type ?? row.metadata.form_type ?? "Corpus",
    text: row.content,
    effectiveDate:
      row.metadata.effective_date ??
      row.metadata.publication_date ??
      row.metadata.filing_date ??
      null,
    authorityLevel:
      row.metadata.authority_tier?.includes("statute") || row.metadata.authority_tier === "regulation"
        ? "high"
        : "medium",
    sourceDocumentId: row.documentId,
    documentType: row.metadata.document_type ?? row.metadata.form_type ?? "REGULATORY_REFERENCE",
    sourceName: row.metadata.source_name ?? row.metadata.agency ?? "Public regulatory corpus",
  }));
}
