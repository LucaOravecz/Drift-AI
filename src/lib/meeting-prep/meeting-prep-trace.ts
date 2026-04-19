import type { RetrievalRunLog } from "@/lib/retrieval/types";

export interface MeetingPrepRetrievalTrace {
  normalizedQueries: string[];
  hydeSnippet: string | null;
  lexicalCandidates: number;
  mergedUniqueBeforeDense: number;
  afterHybridSort: number;
  regulatoryCandidates: number;
  /** Phase 3 tenant retrieval diagnostics */
  retrieval_run_log?: RetrievalRunLog;
  /** Regulatory corpus hybrid (lexical + vector inside service); same log shape */
  regulatory_retrieval_log?: RetrievalRunLog;
}
