import "server-only";

import prisma from "@/lib/db";
import { MeetingPrepService } from "./meeting-prep.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MeetingType =
  | "quarterly_review"
  | "tax_planning"
  | "prospect_discovery"
  | "financial_planning"
  | "compliance_review"
  | "onboarding_kickoff";

export type FailureMode =
  | "hallucinated"
  | "weak_citations"
  | "missing_section"
  | "generic_advice"
  | "compliance_risky";

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

export interface EvalSourceDoc {
  id: string;
  title: string;
  text: string;
  kind?: string;
  authorityLevel?: string;
}

export interface EvalDimensionScores {
  factualAccuracy: number; // 1-5
  citationValidity: number;
  complianceSafety: number;
  usefulness: number;
  completeness: number;
}

export interface EvalScoreResult {
  scores: EvalDimensionScores;
  failures: string[];
  failureModes: FailureMode[];
  pass: boolean;
}

// ---------------------------------------------------------------------------
// Required section titles (must match FINAL_BRIEF_SECTION_ORDER)
// ---------------------------------------------------------------------------

const REQUIRED_SECTIONS = [
  "Meeting purpose",
  "Client snapshot",
  "Open action items",
  "Portfolio / planning flags",
  "Compliance or policy flags",
  "Discussion opportunities",
  "Unresolved questions",
  "Sources / citations",
];

// ---------------------------------------------------------------------------
// Scoring — 1-5 scale
// ---------------------------------------------------------------------------

/** Normalize text for fuzzy matching. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Score a single eval case output against expected qualities. Returns 1-5 per dimension. */
export function scoreEvalOutput(
  markdown: string,
  expected: EvalExpected,
): EvalScoreResult {
  const lower = normalize(markdown);
  const failures: string[] = [];
  const failureModes: FailureMode[] = [];

  // --- Must-mention check ---
  const mustHit = expected.mustMention.filter((phrase) =>
    lower.includes(normalize(phrase)),
  ).length;
  const mustMiss = expected.mustMention.filter(
    (phrase) => !lower.includes(normalize(phrase)),
  );
  for (const phrase of mustMiss) {
    failures.push(`missing_must_mention:${phrase}`);
  }
  if (mustMiss.length > 0) failureModes.push("hallucinated");

  // --- Prohibited errors check ---
  const prohibitedHits = expected.prohibitedErrors.filter((phrase) =>
    lower.includes(normalize(phrase)),
  );
  for (const phrase of prohibitedHits) {
    failures.push(`prohibited_present:${phrase}`);
  }
  if (prohibitedHits.length > 0) failureModes.push("compliance_risky");

  // --- Citation check ---
  const citationHits = expected.expectedCitations.filter((citation) =>
    markdown.includes(citation),
  ).length;
  const citationMisses = expected.expectedCitations.filter(
    (citation) => !markdown.includes(citation),
  );
  for (const c of citationMisses) {
    failures.push(`missing_citation:${c}`);
  }
  if (citationMisses.length > 0 && expected.expectedCitations.length > 0) {
    failureModes.push("weak_citations");
  }

  // --- Missing section check ---
  for (const section of REQUIRED_SECTIONS) {
    const sectionHeader =
      normalize(section).replace(/\s*\/\s*/g, " ").replace(/\s+/g, " ");
    // Check for H2 header
    const hasSection =
      markdown.includes(`## ${section}`) ||
      lower.includes(sectionHeader);
    if (!hasSection) {
      failures.push(`missing_section:${section}`);
      if (!failureModes.includes("missing_section")) {
        failureModes.push("missing_section");
      }
    }
  }

  // --- Generic advice check ---
  const genericPatterns = [
    "consider consulting with",
    "it is important to note",
    "as always",
    "generally speaking",
    "in general",
    "you may want to consider",
    "it depends on your",
  ];
  const genericHits = genericPatterns.filter((p) => lower.includes(p));
  if (genericHits.length >= 2) {
    failureModes.push("generic_advice");
    failures.push(`generic_advice:found_${genericHits.length}_patterns`);
  }

  // --- Compute 1-5 scores ---
  const mustRatio =
    expected.mustMention.length === 0
      ? 1
      : mustHit / expected.mustMention.length;
  const prohibitedPenalty = prohibitedHits.length * 0.35;
  const citationRatio =
    expected.expectedCitations.length === 0
      ? 1
      : citationHits / expected.expectedCitations.length;

  // Factual accuracy: must-mention hit rate minus prohibited penalty, mapped to 1-5
  const factualRaw = Math.max(0, mustRatio - prohibitedPenalty);
  const factualAccuracy = Math.max(1, Math.min(5, Math.round(1 + factualRaw * 4)));

  // Citation validity: citation hit rate mapped to 1-5
  const citationValidity = Math.max(
    1,
    Math.min(5, Math.round(1 + citationRatio * 4)),
  );

  // Compliance safety: inverse of prohibited hits, mapped to 1-5
  const complianceSafety =
    prohibitedHits.length === 0
      ? 5
      : prohibitedHits.length === 1
        ? 3
        : 1;

  // Usefulness: blend of factual and citation
  const usefulnessRaw = 0.55 * factualRaw + 0.45 * citationRatio;
  const usefulness = Math.max(1, Math.min(5, Math.round(1 + usefulnessRaw * 4)));

  // Completeness: must-mention ratio mapped to 1-5
  const completeness = Math.max(
    1,
    Math.min(5, Math.round(1 + mustRatio * 4)),
  );

  const scores: EvalDimensionScores = {
    factualAccuracy,
    citationValidity,
    complianceSafety,
    usefulness,
    completeness,
  };

  // Weighted average for pass/fail
  const weights = {
    factualAccuracy: expected.rubric?.factualAccuracy ?? 0.25,
    citationValidity: expected.rubric?.citationValidity ?? 0.25,
    complianceSafety: expected.rubric?.complianceSafety ?? 0.20,
    usefulness: expected.rubric?.usefulness ?? 0.15,
    completeness: expected.rubric?.completeness ?? 0.15,
  };
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const weightedAvg =
    ((scores.factualAccuracy * weights.factualAccuracy +
      scores.citationValidity * weights.citationValidity +
      scores.complianceSafety * weights.complianceSafety +
      scores.usefulness * weights.usefulness +
      scores.completeness * weights.completeness) /
      weightSum /
      5); // normalize to 0-1

  const pass = failures.length === 0 && weightedAvg >= 0.72;

  return { scores, failures, failureModes: [...new Set(failureModes)], pass };
}

// ---------------------------------------------------------------------------
// Failure mode aggregation
// ---------------------------------------------------------------------------

export function aggregateFailureModes(
  results: Array<{ failureModes: FailureMode[] }>,
): Record<FailureMode, number> {
  const counts: Record<FailureMode, number> = {
    hallucinated: 0,
    weak_citations: 0,
    missing_section: 0,
    generic_advice: 0,
    compliance_risky: 0,
  };
  for (const r of results) {
    for (const mode of r.failureModes) {
      counts[mode] = (counts[mode] ?? 0) + 1;
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Eval Runner
// ---------------------------------------------------------------------------

export class EvalService {
  /** Create a new eval run, execute all active cases, persist results. */
  static async runEvals(params: {
    label?: string;
    meetingTypes?: MeetingType[];
    caseIds?: string[];
    configSnapshot?: Record<string, unknown>;
    /** If true, call the live MeetingPrepService. If false, score against fixture markdown stored in the case. */
    live?: boolean;
    /** Organization ID required for live pipeline calls. */
    organizationId?: string;
  }): Promise<{
    runId: string;
    caseCount: number;
    passedCount: number;
    failedCount: number;
    passRate: number;
    failureModes: Record<FailureMode, number>;
    durationMs: number;
  }> {
    const start = Date.now();

    // Load cases
    const where: Record<string, unknown> = { isActive: true };
    if (params.meetingTypes?.length) {
      where.meetingType = { in: params.meetingTypes };
    }
    if (params.caseIds?.length) {
      where.caseId = { in: params.caseIds };
    }

    const cases = await prisma.evalCase.findMany({
      where,
      orderBy: { caseId: "asc" },
    });

    if (cases.length === 0) {
      throw new Error("No active eval cases found matching filters.");
    }

    // Create run record
    const run = await prisma.evalRun.create({
      data: {
        label: params.label ?? `eval-${new Date().toISOString().replace(/[:.]/g, "-")}`,
        caseCount: cases.length,
        configSnapshot: (params.configSnapshot ?? undefined) as any,
      },
    });

    const allResults: Array<{
      caseId: string;
      scores: EvalDimensionScores;
      failures: string[];
      failureModes: FailureMode[];
      pass: boolean;
      output: string | null;
      verification: Record<string, unknown> | null;
    }> = [];

    // Execute each case
    for (const evalCase of cases) {
      const expected: EvalExpected = evalCase.expectedQualities as unknown as EvalExpected;
      let output: string | null = null;
      const verification: Record<string, unknown> | null = null;

      if (params.live && params.organizationId) {
        // TODO: Wire to live pipeline when eval meetings exist in the database.
        // For now, live mode requires a meetingId mapping that doesn't exist yet.
        // Fall back to fixture scoring.
        output =
          (evalCase.sourceDocuments as Array<{ fixtureMarkdown?: string }>)?.find(
            (d) => d.fixtureMarkdown,
          )?.fixtureMarkdown ?? null;
      }

      // If no output from live pipeline, use a minimal fixture
      if (!output) {
        const sources = evalCase.sourceDocuments as unknown as EvalSourceDoc[];
        output = sources
          .map((s) => `## ${s.title}\n${s.text}`)
          .join("\n\n");
      }

      const scored = scoreEvalOutput(output, expected);

      await prisma.evalRunCase.create({
        data: {
          runId: run.id,
          caseId: evalCase.caseId,
          modelOutput: output,
          verificationJson: verification ?? undefined,
          scoreFactual: scored.scores.factualAccuracy,
          scoreCitation: scored.scores.citationValidity,
          scoreCompliance: scored.scores.complianceSafety,
          scoreUsefulness: scored.scores.usefulness,
          scoreCompleteness: scored.scores.completeness,
          passed: scored.pass,
          failureModes: scored.failureModes,
        },
      });

      allResults.push({
        caseId: evalCase.caseId,
        scores: scored.scores,
        failures: scored.failures,
        failureModes: scored.failureModes,
        pass: scored.pass,
        output,
        verification,
      });
    }

    const passedCount = allResults.filter((r) => r.pass).length;
    const failedCount = allResults.length - passedCount;
    const passRate = allResults.length ? passedCount / allResults.length : 0;
    const failureModes = aggregateFailureModes(allResults);

    const meanScore = (dim: keyof EvalDimensionScores) => {
      const vals = allResults.map((r) => r.scores[dim]);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };

    const durationMs = Date.now() - start;

    await prisma.evalRun.update({
      where: { id: run.id },
      data: {
        passedCount,
        failedCount,
        passRate,
        meanFactual: meanScore("factualAccuracy"),
        meanCitation: meanScore("citationValidity"),
        meanCompliance: meanScore("complianceSafety"),
        meanUsefulness: meanScore("usefulness"),
        meanCompleteness: meanScore("completeness"),
        failureModes: failureModes as any,
        completedAt: new Date(),
        durationMs,
      },
    });

    return {
      runId: run.id,
      caseCount: cases.length,
      passedCount,
      failedCount,
      passRate,
      failureModes,
      durationMs,
    };
  }

  /** Get run history for trend analysis. */
  static async getRunHistory(limit = 20) {
    return prisma.evalRun.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
      select: {
        id: true,
        label: true,
        caseCount: true,
        passedCount: true,
        failedCount: true,
        passRate: true,
        meanFactual: true,
        meanCitation: true,
        meanCompliance: true,
        meanUsefulness: true,
        meanCompleteness: true,
        failureModes: true,
        startedAt: true,
        completedAt: true,
        durationMs: true,
      },
    });
  }

  /** Get detailed results for a specific run. */
  static async getRunResults(runId: string) {
    return prisma.evalRunCase.findMany({
      where: { runId },
      include: {
        case: {
          select: {
            caseId: true,
            meetingType: true,
            prompt: true,
            difficulty: true,
            tags: true,
          },
        },
      },
      orderBy: { caseId: "asc" },
    });
  }

  /** Add reviewer notes to a run case. */
  static async addReviewerNotes(
    runCaseId: string,
    reviewerUserId: string,
    notes: string,
    scores?: Partial<EvalDimensionScores>,
  ) {
    return prisma.evalRunCase.update({
      where: { id: runCaseId },
      data: {
        reviewerNotes: notes,
        reviewerUserId,
        reviewedAt: new Date(),
        ...(scores?.factualAccuracy != null
          ? { scoreFactual: scores.factualAccuracy }
          : {}),
        ...(scores?.citationValidity != null
          ? { scoreCitation: scores.citationValidity }
          : {}),
        ...(scores?.complianceSafety != null
          ? { scoreCompliance: scores.complianceSafety }
          : {}),
        ...(scores?.usefulness != null
          ? { scoreUsefulness: scores.usefulness }
          : {}),
        ...(scores?.completeness != null
          ? { scoreCompleteness: scores.completeness }
          : {}),
      },
    });
  }
}
