export type FindingConfidence = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";

export interface ExplainableFinding {
  insight: string;
  trigger: string;
  evidence: string[];
  whyItMatters: string;
  consequenceIfIgnored: string;
  nextBestAction: string;
  confidence: FindingConfidence;
  reviewRequired: boolean;
  missingData: string[];
}

export function serializeFinding(finding: ExplainableFinding) {
  return JSON.stringify(finding);
}

export function parseFinding(raw: string | null | undefined): ExplainableFinding | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ExplainableFinding>;
    if (
      typeof parsed.insight === "string" &&
      typeof parsed.trigger === "string" &&
      Array.isArray(parsed.evidence) &&
      typeof parsed.whyItMatters === "string" &&
      typeof parsed.consequenceIfIgnored === "string" &&
      typeof parsed.nextBestAction === "string" &&
      typeof parsed.confidence === "string" &&
      typeof parsed.reviewRequired === "boolean" &&
      Array.isArray(parsed.missingData)
    ) {
      return parsed as ExplainableFinding;
    }
  } catch {
    return null;
  }

  return null;
}

export function confidenceToScore(confidence: FindingConfidence) {
  switch (confidence) {
    case "HIGH":
      return 90;
    case "MEDIUM":
      return 70;
    case "LOW":
      return 45;
    case "INSUFFICIENT":
      return 20;
  }
}
