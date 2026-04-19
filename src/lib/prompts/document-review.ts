export type ReviewType = "ips" | "advisory_agreement" | "client_letter" | "compliance_scan";

export const DOCUMENT_REVIEW_SYSTEM = `You are a senior financial-services compliance reviewer. You produce line-level suggestions on advisor documents. You return ONLY valid JSON matching the schema provided. You do not invent text that is not in the document. If a suggestion cannot be made from the document alone, omit it.`;

export const buildReviewPrompt = (docText: string, reviewType: ReviewType) => `
REVIEW TYPE: ${reviewType}

DOCUMENT:
"""
${docText}
"""

Return JSON with this exact schema:
{
  "summary": "2-3 sentence overall assessment",
  "severity": "low" | "med" | "high",
  "suggestions": [
    {
      "id": "uuid string",
      "originalText": "verbatim substring from the document",
      "suggestedText": "proposed replacement (may be empty string to delete)",
      "reason": "1-2 sentence justification",
      "category": "compliance" | "clarity" | "accuracy" | "tone" | "missing_disclosure",
      "severity": "low" | "med" | "high",
      "citations": [{ "source": "string", "url": "string (optional)" }]
    }
  ]
}

Rules:
- originalText MUST appear verbatim in the document. If unsure about the match, omit the suggestion.
- Prefer additive disclosures over rewrites for compliance items.
- Cap at 12 suggestions.
`;
