/** Shared query normalization for BM25 / dense retrieval. */

export function normalizeRetrievalQuery(raw: string): string {
  return raw
    .replace(/\r/g, "\n")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s.,%-]/gu, " ")
    .trim()
    .slice(0, 512);
}
