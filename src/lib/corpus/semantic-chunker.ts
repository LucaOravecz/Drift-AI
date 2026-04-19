import { createHash } from "crypto"
import type { ChunkSeed, CorpusChunkMetadata } from "@/lib/corpus/types"

const HEADING_PATTERN = /^((title|part|subpart|chapter|section|sec\.|rule|article|item|clause|\([a-z0-9]+\)|[A-Z]\.|\d+\.))\s+/i

function cleanLine(line: string): string {
  return line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
}

function buildChunk(
  headingTrail: string[],
  lines: string[],
  metadata: CorpusChunkMetadata,
): ChunkSeed | null {
  const content = lines.map(cleanLine).filter(Boolean).join("\n").trim()
  if (!content) return null

  return {
    headingPath: headingTrail.length > 0 ? headingTrail.join(" > ") : undefined,
    headingTitle: headingTrail.at(-1),
    content,
    metadata,
  }
}

export function semanticChunkText(
  rawText: string,
  metadata: CorpusChunkMetadata,
): ChunkSeed[] {
  const lines = rawText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean)

  const chunks: ChunkSeed[] = []
  const headingTrail: string[] = []
  let buffer: string[] = []

  const flush = () => {
    const chunk = buildChunk(headingTrail, buffer, metadata)
    if (chunk) chunks.push(chunk)
    buffer = []
  }

  for (const line of lines) {
    const isHeading =
      HEADING_PATTERN.test(line) ||
      (/^[A-Z][A-Z\s,&/-]{6,}$/.test(line) && line.length <= 160)

    if (isHeading) {
      flush()
      if (headingTrail.length > 0 && !line.includes(headingTrail.at(-1) ?? "")) {
        const last = headingTrail.at(-1)
        if (last && !line.startsWith(last)) {
          headingTrail.splice(Math.max(headingTrail.length - 1, 0), 1)
        }
      }
      headingTrail.push(line)
      continue
    }

    buffer.push(line)

    if (buffer.join(" ").length > 2200) {
      flush()
    }
  }

  flush()
  return chunks
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex")
}

export function normalizedCitation(value?: string | null): string | null {
  if (!value) return null
  return value.replace(/\s+/g, " ").trim()
}
