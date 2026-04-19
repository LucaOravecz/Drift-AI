/**
 * Phase 3 tenant vault retrieval: normalize → BM25 ∪ dense → merge → blend scores → pool for rerank.
 * Structured logging for queries, candidates, scores, and final picks.
 */

import "server-only";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { cosineSimilarity, hashedEmbedding } from "@/lib/corpus/hashed-embedding";
import { logger } from "@/lib/logger";
import { normalizeRetrievalQuery } from "@/lib/retrieval/query-normalize";
import type { RetrievalCandidateScore, RetrievalRunLog, TenantEvidenceLike } from "@/lib/retrieval/types";

export interface TenantRetrievalFilters {
  organizationId: string;
  clientId: string;
  documentTypes?: string[];
  jurisdiction?: string | null;
  effectiveBefore?: Date;
  effectiveAfter?: Date;
  sourceTypes?: string[];
}

export interface TenantRetrievalInput {
  rawQueries: string[];
  filters: TenantRetrievalFilters;
  expandedHypothesis?: string | null;
  meetingId?: string;
}

export const TENANT_POOL = {
  BM25_PER_QUERY: 100,
  DENSE_SCAN_LIMIT: 180,
  DENSE_EXTRA_TOP: 40,
  MERGED_TOP: 45,
} as const;

type ChunkRow = {
  id: string;
  lexicalScore: number;
  documentId: string;
  sectionPath: string;
  text: string;
  keywordText: string;
  title: string | null;
  fileName: string;
  effectiveDate: Date | null;
  uploadedAt: Date;
  authorityLevel: string | null;
  documentType: string | null;
  sourceType: string | null;
  jurisdiction: string | null;
};

function buildDocWhere(filters: TenantRetrievalFilters): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`d."clientId" = ${filters.clientId}`,
    Prisma.sql`dc."organizationId" = ${filters.organizationId}`,
    Prisma.sql`d."deletedAt" IS NULL`,
    Prisma.sql`d.status IN ('SUMMARIZED'::text, 'REVIEWED'::text)`,
  ];
  if (filters.documentTypes?.length) {
    parts.push(Prisma.sql`d."documentType" IN (${Prisma.join(filters.documentTypes)})`);
  }
  if (filters.jurisdiction) {
    parts.push(Prisma.sql`d.jurisdiction = ${filters.jurisdiction}`);
  }
  if (filters.effectiveBefore) {
    parts.push(Prisma.sql`(d."effectiveDate" IS NOT NULL AND d."effectiveDate" <= ${filters.effectiveBefore})`);
  }
  if (filters.effectiveAfter) {
    parts.push(Prisma.sql`(d."effectiveDate" IS NOT NULL AND d."effectiveDate" >= ${filters.effectiveAfter})`);
  }
  if (filters.sourceTypes?.length) {
    parts.push(Prisma.sql`d."sourceType" IN (${Prisma.join(filters.sourceTypes)})`);
  }
  return Prisma.join(parts, " AND ");
}

async function bm25Retrieve(query: string, docWhere: Prisma.Sql, limit: number): Promise<ChunkRow[]> {
  const q = normalizeRetrievalQuery(query);
  if (!q) return [];

  return prisma.$queryRaw<ChunkRow[]>`
    SELECT
      dc.id,
      ts_rank_cd(
        to_tsvector('english', COALESCE(dc."keywordText", '') || ' ' || dc.text),
        websearch_to_tsquery('english', ${q})
      ) AS "lexicalScore",
      dc."documentId",
      dc."sectionPath",
      dc.text,
      dc."keywordText",
      d.title,
      d."fileName",
      d."effectiveDate",
      d."uploadedAt",
      d."authorityLevel",
      d."documentType",
      d."sourceType",
      d.jurisdiction
    FROM document_chunks dc
    INNER JOIN documents d ON d.id = dc."documentId"
    WHERE ${docWhere}
      AND to_tsvector('english', COALESCE(dc."keywordText", '') || ' ' || dc.text)
        @@ websearch_to_tsquery('english', ${q})
    ORDER BY "lexicalScore" DESC
    LIMIT ${limit}
  `;
}

async function denseScanRecent(docWhere: Prisma.Sql, excludeIds: string[], limit: number): Promise<ChunkRow[]> {
  const exclusion =
    excludeIds.length > 0 ? Prisma.sql`AND dc.id NOT IN (${Prisma.join(excludeIds)})` : Prisma.empty;

  return prisma.$queryRaw<ChunkRow[]>`
    SELECT
      dc.id,
      0::float AS "lexicalScore",
      dc."documentId",
      dc."sectionPath",
      dc.text,
      dc."keywordText",
      d.title,
      d."fileName",
      d."effectiveDate",
      d."uploadedAt",
      d."authorityLevel",
      d."documentType",
      d."sourceType",
      d.jurisdiction
    FROM document_chunks dc
    INNER JOIN documents d ON d.id = dc."documentId"
    WHERE ${docWhere}
    ${exclusion}
    ORDER BY d."uploadedAt" DESC NULLS LAST, dc."updatedAt" DESC
    LIMIT ${limit}
  `;
}

function freshnessWeight(effective: Date | null, uploaded: Date): number {
  const ref = effective ?? uploaded;
  const ageYears = (Date.now() - ref.getTime()) / (365.25 * 86400000);
  if (ageYears <= 1) return 1;
  if (ageYears <= 3) return 0.92;
  if (ageYears <= 7) return 0.78;
  return 0.62;
}

function authorityNumeral(level: string | null, docType: string | null): number {
  const l = (level ?? "").toLowerCase();
  if (l.includes("high")) return 1;
  if (docType?.includes("TRUST") || docType?.includes("ESTATE")) return 0.95;
  if (l.includes("low")) return 0.45;
  return 0.72;
}

function summaryPenalty(sourceType: string | null): number {
  const s = (sourceType ?? "").toLowerCase();
  if (s.includes("summary") || s.includes("digest")) return 0.82;
  return 1;
}

function stalenessNote(effective: Date | null, uploaded: Date, authorityLevel: string | null): string | null {
  const ref = effective ?? uploaded;
  const ageYears = (Date.now() - ref.getTime()) / (365.25 * 86400000);
  const notes: string[] = [];
  if (ageYears > 5) notes.push("older effective/reference material");
  if ((authorityLevel ?? "").toLowerCase().includes("low")) notes.push("lower recorded authority tier");
  if (notes.length === 0) return null;
  return notes.join("; ");
}

export async function runTenantRetrieval(input: TenantRetrievalInput): Promise<{ hits: TenantEvidenceLike[]; log: RetrievalRunLog }> {
  const docWhere = buildDocWhere(input.filters);

  const normalizedQueries = [
    ...input.rawQueries.map((q) => normalizeRetrievalQuery(q)),
    ...(input.expandedHypothesis ? [normalizeRetrievalQuery(input.expandedHypothesis)] : []),
  ].filter(Boolean);

  const combinedQueryText = normalizedQueries.join(" ").slice(0, 512) || "document retrieval";
  const queryVector = hashedEmbedding(combinedQueryText);

  logger.info("retrieval.tenant.query_received", {
    organizationId: input.filters.organizationId,
    clientId: input.filters.clientId,
    meetingId: input.meetingId,
    raw_queries: input.rawQueries,
    normalized_queries: normalizedQueries,
    expanded_hypothesis: input.expandedHypothesis ?? null,
  });

  const bm25ById = new Map<string, ChunkRow & { bm25: number }>();
  for (const q of normalizedQueries) {
    const rows = await bm25Retrieve(q, docWhere, TENANT_POOL.BM25_PER_QUERY);
    for (const row of rows) {
      const lex = Number(row.lexicalScore ?? 0);
      const prev = bm25ById.get(row.id);
      if (!prev || lex > prev.bm25) bm25ById.set(row.id, { ...row, bm25: lex });
    }
  }

  const bm25Ids = [...bm25ById.keys()];
  logger.info("retrieval.tenant.bm25_candidates", {
    organizationId: input.filters.organizationId,
    meetingId: input.meetingId,
    candidate_ids: bm25Ids.slice(0, 120),
    candidate_count: bm25Ids.length,
  });

  const denseRows = await denseScanRecent(docWhere, bm25Ids, TENANT_POOL.DENSE_SCAN_LIMIT);

  const denseRanked = denseRows
    .map((row) => {
      const emb = hashedEmbedding(`${row.title ?? ""}\n${row.sectionPath}\n${row.text}`);
      const dense = cosineSimilarity(queryVector, emb);
      return { row, dense };
    })
    .sort((a, b) => b.dense - a.dense)
    .slice(0, TENANT_POOL.DENSE_EXTRA_TOP);

  logger.info("retrieval.tenant.dense_candidates", {
    organizationId: input.filters.organizationId,
    meetingId: input.meetingId,
    candidate_ids: denseRanked.map((r) => r.row.id),
    dense_top_scores: denseRanked.slice(0, 15).map((r) => ({ id: r.row.id, dense: Number(r.dense.toFixed(4)) })),
  });

  const merged = new Map<string, ChunkRow & { bm25: number; dense: number }>();

  const maxBm25 = Math.max(0.001, ...[...bm25ById.values()].map((r) => r.bm25));

  for (const id of bm25Ids) {
    const r = bm25ById.get(id)!;
    const emb = hashedEmbedding(`${r.title ?? ""}\n${r.sectionPath}\n${r.text}`);
    const dense = cosineSimilarity(queryVector, emb);
    merged.set(id, { ...r, bm25: r.bm25, dense });
  }

  for (const { row, dense } of denseRanked) {
    if (merged.has(row.id)) continue;
    merged.set(row.id, { ...row, bm25: 0, dense });
  }

  const mergedUniqueIds = [...merged.keys()];

  const scored = [...merged.values()].map((row) => {
    const lexNorm = Math.min(1, row.bm25 / maxBm25);
    const denseNorm = (row.dense + 1) / 2;
    const fresh = freshnessWeight(row.effectiveDate, row.uploadedAt);
    const auth = authorityNumeral(row.authorityLevel, row.documentType);
    const sumPen = summaryPenalty(row.sourceType);
    const tenantBoost = 1.08;
    const hybridCore = lexNorm * 0.38 + denseNorm * 0.34 + auth * 0.14 + fresh * 0.1;
    const finalBlend = hybridCore * tenantBoost * sumPen;

    const candidateScore: RetrievalCandidateScore = {
      chunk_id: row.id,
      bm25_lexical: row.bm25,
      dense_similarity: row.dense,
      hybrid_before_boost: hybridCore,
      tenant_client_boost: tenantBoost,
      freshness_boost: fresh,
      conflict_penalty: sumPen < 1 ? 1 - sumPen : 0,
      final_blend_score: Math.min(1.5, finalBlend),
    };

    return { row, candidateScore, finalBlend };
  });

  scored.sort((a, b) => b.finalBlend - a.finalBlend);
  const pool = scored.slice(0, TENANT_POOL.MERGED_TOP);

  logger.info("retrieval.tenant.merge_rerank_scores", {
    organizationId: input.filters.organizationId,
    meetingId: input.meetingId,
    merged_unique_count: mergedUniqueIds.length,
    pool_top_scores: pool.slice(0, 20).map((p) => ({
      chunk_id: p.row.id,
      final_blend_score: Number(p.finalBlend.toFixed(5)),
      bm25: Number(p.row.bm25.toFixed(5)),
      dense: Number(p.row.dense.toFixed(5)),
    })),
  });

  const hits: TenantEvidenceLike[] = pool.map(({ row, candidateScore }) => {
    const note = stalenessNote(row.effectiveDate, row.uploadedAt, row.authorityLevel);
    const summaryNote = summaryPenalty(row.sourceType) < 1 ? "Summary/secondary source — verify against primary documents when applicable." : null;
    const quality = [note, summaryNote].filter(Boolean).join(" · ") || null;

    return {
      id: row.id,
      kind: "document_chunk",
      title: row.title ?? row.fileName,
      sectionPath: row.sectionPath,
      text: row.text,
      effectiveDate: row.effectiveDate?.toISOString() ?? null,
      authorityLevel: row.authorityLevel ?? "medium",
      sourceDocumentId: row.documentId,
      documentType: row.documentType ?? null,
      sourceName: row.title ?? row.fileName,
      retrieval_quality_note: quality,
    };
  });

  const log: RetrievalRunLog = {
    raw_queries: input.rawQueries,
    normalized_queries: normalizedQueries,
    expanded_hypothesis_present: Boolean(input.expandedHypothesis?.trim()),
    bm25_candidate_ids: bm25Ids.slice(0, 200),
    dense_candidate_ids: denseRanked.map((r) => r.row.id),
    merged_unique_ids: mergedUniqueIds,
    rerank_scores: pool.map((p) => p.candidateScore),
    final_selected_ids: hits.map((h) => h.id),
    staleness_warnings: hits.map((h) => h.retrieval_quality_note).filter(Boolean) as string[],
    pipeline: "tenant_vault",
  };

  logger.info("retrieval.tenant.final_chunks", {
    organizationId: input.filters.organizationId,
    clientId: input.filters.clientId,
    meetingId: input.meetingId,
    final_selected_ids: log.final_selected_ids,
    count: hits.length,
  });

  return { hits, log };
}
