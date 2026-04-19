/**
 * Semantic vault chunking — boundaries: title → section → subsection → paragraph → clause.
 * Uses heading detection + paragraph flush + max span (aligned with corpus semanticChunkText).
 */

import { semanticChunkText } from "@/lib/corpus/semantic-chunker";
import type { CorpusChunkMetadata } from "@/lib/corpus/types";

const MAX_CHARS = 2200;

const CLAUSE_LINE = /^(\([a-z0-9]+\)|\([ivx]+\)|[a-z]\))\s+.+/i;

export type BoundaryType = "title" | "section" | "subsection" | "paragraph" | "clause";

export interface VaultSemanticChunk {
  sectionPath: string;
  text: string;
  boundary_type: BoundaryType;
  headings: string[];
}

function headingDepth(line: string): number {
  const compact = line.trim();
  if (/^(title|appendix|schedule)\b/i.test(compact)) return 0;
  if (/^(part|chapter|article)\b/i.test(compact)) return 1;
  if (/^section\s+/i.test(compact) || /^\d+\.\s+[A-Z]/.test(compact)) return 2;
  if (/^[A-Z][A-Z\s,&/-]{6,}$/.test(compact) && compact.length <= 160) return 2;
  if (CLAUSE_LINE.test(compact)) return 4;
  return 3;
}

function boundaryFromDepth(depth: number, isClause: boolean): BoundaryType {
  if (isClause) return "clause";
  if (depth <= 0) return "title";
  if (depth <= 2) return "section";
  if (depth <= 3) return "subsection";
  return "paragraph";
}

/**
 * Primary path: reuse corpus semanticChunkText for heading/paragraph structure, then annotate boundaries.
 */
export function semanticChunkVaultDocument(rawText: string, documentTitle: string): VaultSemanticChunk[] {
  const placeholderMeta: CorpusChunkMetadata = {
    source_name: documentTitle,
    source_type: "vault_document",
    authority_tier: "firm disclosure",
    jurisdiction: "US",
    agency: "client_vault",
    source_url: "",
    citation: documentTitle,
  };

  const seeds = semanticChunkText(rawText, placeholderMeta);
  if (seeds.length === 0) {
    const body = rawText.replace(/\r/g, "\n").trim();
    if (!body) return [];
    return [
      {
        sectionPath: `${documentTitle || "Document"} > Body`,
        text: body.slice(0, 12000),
        boundary_type: "paragraph",
        headings: [],
      },
    ];
  }

  return seeds.map((seed) => {
    const path = seed.headingPath ?? `${documentTitle} > Section`;
    const depth = seed.headingTitle ? headingDepth(seed.headingTitle) : 3;
    const isClause = seed.headingTitle ? CLAUSE_LINE.test(seed.headingTitle) : false;
    const headings = path.split(">").map((s) => s.trim()).filter(Boolean);
    let bt = boundaryFromDepth(depth, isClause);
    if ((seed.content?.length ?? 0) > MAX_CHARS) bt = "paragraph";

    return {
      sectionPath: path,
      text: seed.content.trim(),
      boundary_type: bt,
      headings,
    };
  });
}
