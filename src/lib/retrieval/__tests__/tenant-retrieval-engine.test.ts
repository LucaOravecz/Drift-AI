import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();

vi.mock("@/lib/db", () => ({
  default: {
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { runTenantRetrieval } from "@/lib/retrieval/tenant-retrieval-engine";

function chunkRow(
  id: string,
  overrides: Partial<{
    lexicalScore: number;
    text: string;
    title: string;
    documentId: string;
    sourceType: string | null;
    authorityLevel: string | null;
    effectiveDate: Date | null;
    uploadedAt: Date;
  }> = {},
) {
  const uploadedAt = overrides.uploadedAt ?? new Date("2024-06-01");
  const effectiveDate = overrides.effectiveDate ?? new Date("2024-01-01");
  return {
    id,
    lexicalScore: overrides.lexicalScore ?? 0.42,
    documentId: overrides.documentId ?? "doc_1",
    sectionPath: "Article I > Section A",
    text: overrides.text ?? "Required minimum distribution rules for inherited IRAs.",
    keywordText: "rmd ira",
    title: overrides.title ?? "Custodial agreement",
    fileName: "custodial.pdf",
    effectiveDate,
    uploadedAt,
    authorityLevel: overrides.authorityLevel ?? "high",
    documentType: "TRUST_AGREEMENT",
    sourceType: overrides.sourceType ?? "planning_document",
    jurisdiction: "US",
  };
}

describe("runTenantRetrieval", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("merges BM25 hits with dense-only rows and returns tenant_vault RetrievalRunLog", async () => {
    const bm25Hit = chunkRow("chunk_bm25", { lexicalScore: 0.95, text: "BM25 matched text" });
    const denseOnly = chunkRow("chunk_dense_only", {
      lexicalScore: 0,
      text: "Dense supplement text",
      title: "Other doc",
      documentId: "doc_2",
    });

    queryRaw.mockResolvedValueOnce([bm25Hit]).mockResolvedValueOnce([denseOnly]);

    const { hits, log } = await runTenantRetrieval({
      rawQueries: ["RMD inherited IRA"],
      filters: { organizationId: "org_1", clientId: "client_1" },
      meetingId: "meet_1",
    });

    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(log.pipeline).toBe("tenant_vault");
    expect(log.raw_queries).toEqual(["RMD inherited IRA"]);
    expect(log.bm25_candidate_ids).toContain("chunk_bm25");
    expect(log.merged_unique_ids.sort()).toEqual(["chunk_bm25", "chunk_dense_only"].sort());
    expect(log.final_selected_ids.length).toBeGreaterThan(0);
    expect(log.rerank_scores?.length).toBe(log.final_selected_ids.length);

    const hitIds = new Set(hits.map((h) => h.id));
    expect(hitIds.has("chunk_bm25")).toBe(true);
    expect(hitIds.has("chunk_dense_only")).toBe(true);
  });

  it("includes expanded hypothesis as an extra normalized query (extra BM25 round)", async () => {
    const row = chunkRow("c1", { lexicalScore: 0.8 });
    queryRaw.mockResolvedValue([row]);

    await runTenantRetrieval({
      rawQueries: ["tax planning"],
      expandedHypothesis: "Focus on bracket management",
      filters: { organizationId: "org", clientId: "cli" },
    });

    expect(queryRaw).toHaveBeenCalledTimes(3);
  });
});
