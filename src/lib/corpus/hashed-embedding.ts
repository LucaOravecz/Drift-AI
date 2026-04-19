import { sha256 } from "@/lib/corpus/semantic-chunker";

export const HASHED_EMBEDDING_DIMENSIONS = 256;

/** Local hashing-vector embedding — no paid embedding API (matches regulatory corpus chunks). */
export function hashedEmbedding(text: string): number[] {
  const vector = Array.from({ length: HASHED_EMBEDDING_DIMENSIONS }, () => 0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);

  for (const token of tokens) {
    const digest = sha256(token);
    for (let i = 0; i < 8; i++) {
      const start = i * 8;
      const slice = digest.slice(start, start + 8);
      const bucket = Number.parseInt(slice, 16) % HASHED_EMBEDDING_DIMENSIONS;
      const sign = Number.parseInt(slice.slice(-1), 16) % 2 === 0 ? 1 : -1;
      vector[bucket] += sign;
    }
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let score = 0;
  for (let i = 0; i < length; i++) score += left[i]! * right[i]!;
  return score;
}
