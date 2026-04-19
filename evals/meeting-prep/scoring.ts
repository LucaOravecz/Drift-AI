/**
 * Offline scoring for meeting prep outputs (no LLM judge).
 * Used by `evals/meeting-prep/runner.ts` and unit tests.
 */

export interface EvalExpected {
  mustMention: string[];
  prohibitedErrors: string[];
  expectedCitations: string[];
  rubric?: {
    factualAccuracy?: number;
    citationValidity?: number;
    complianceSafety?: number;
    usefulness?: number;
    completeness?: number;
  };
}

export interface DimensionScores {
  factualAccuracy: number;
  citationValidity: number;
  complianceSafety: number;
  usefulness: number;
  completeness: number;
}

export interface ScoreResult {
  scores: DimensionScores;
  failures: string[];
  pass: boolean;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

/** Score markdown + optional rendered schema JSON string for citation checks. */
export function scoreMeetingPrepOutput(markdown: string, expected: EvalExpected): ScoreResult {
  const failures: string[] = [];
  const lower = markdown.toLowerCase();

  for (const phrase of expected.mustMention) {
    if (!lower.includes(phrase.toLowerCase())) {
      failures.push(`missing_must_mention:${phrase}`);
    }
  }

  for (const bad of expected.prohibitedErrors) {
    if (lower.includes(bad.toLowerCase())) {
      failures.push(`prohibited_present:${bad}`);
    }
  }

  for (const citation of expected.expectedCitations) {
    if (!markdown.includes(citation)) {
      failures.push(`missing_citation_token:${citation}`);
    }
  }

  const mustHit =
    expected.mustMention.length === 0 ?
      1
    : expected.mustMention.filter((phrase) => lower.includes(phrase.toLowerCase())).length /
      expected.mustMention.length;

  const citationHit =
    expected.expectedCitations.length === 0 ?
      1
    : expected.expectedCitations.filter((c) => markdown.includes(c)).length / expected.expectedCitations.length;

  const prohibitedPenalty =
    expected.prohibitedErrors.filter((bad) => lower.includes(bad.toLowerCase())).length * 0.35;

  const factualAccuracy = clamp01(mustHit - prohibitedPenalty);
  const citationValidity = clamp01(citationHit);
  const complianceSafety = clamp01(1 - prohibitedPenalty);
  const usefulness = clamp01(0.55 * factualAccuracy + 0.45 * citationValidity);
  const completeness = clamp01(mustHit);

  const scores: DimensionScores = {
    factualAccuracy,
    citationValidity,
    complianceSafety,
    usefulness,
    completeness,
  };

  const weighted =
    (scores.factualAccuracy * (expected.rubric?.factualAccuracy ?? 0.25) +
      scores.citationValidity * (expected.rubric?.citationValidity ?? 0.25) +
      scores.complianceSafety * (expected.rubric?.complianceSafety ?? 0.2) +
      scores.usefulness * (expected.rubric?.usefulness ?? 0.15) +
      scores.completeness * (expected.rubric?.completeness ?? 0.15)) /
    Math.max(
      1e-6,
      (expected.rubric?.factualAccuracy ?? 0.25) +
        (expected.rubric?.citationValidity ?? 0.25) +
        (expected.rubric?.complianceSafety ?? 0.2) +
        (expected.rubric?.usefulness ?? 0.15) +
        (expected.rubric?.completeness ?? 0.15),
    );

  return {
    scores,
    failures,
    pass: failures.length === 0 && weighted >= 0.72,
  };
}
