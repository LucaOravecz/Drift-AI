"use server";

import { revalidatePath } from "next/cache";

/**
 * Server action to trigger a document review from the review page.
 */
export async function callReviewEndpoint(documentId: string, organizationId: string) {
  const prisma = (await import("@/lib/db")).default;
  const { callClaudeJSON } = await import("@/lib/services/ai.service");
  const { DOCUMENT_REVIEW_SYSTEM, buildReviewPrompt } = await import("@/lib/prompts/document-review");

  const document = await prisma.document.findUnique({
    where: { id: documentId, organizationId },
  });

  if (!document || !document.rawText) {
    throw new Error("Document not found or has no text");
  }

  const docType = (document.documentType ?? "").toLowerCase();
  const reviewType = docType.includes("ips")
    ? "ips"
    : docType.includes("agreement")
      ? "advisory_agreement"
      : docType.includes("letter")
        ? "client_letter"
        : "compliance_scan";

  const userPrompt = buildReviewPrompt(document.rawText, reviewType as any);

  const result = await callClaudeJSON<{
    summary: string;
    severity: string;
    suggestions: any[];
  }>(DOCUMENT_REVIEW_SYSTEM, userPrompt, { organizationId });

  const validSuggestions = result.suggestions?.filter((s: any) => {
    if (!s.originalText) return false;
    const indexOf = document.rawText!.indexOf(s.originalText);
    if (indexOf === -1) {
      console.warn(`[DocumentReviewAction] Dropped hallucinated text: "${s.originalText.substring(0, 50)}..."`);
      return false;
    }
    return true;
  }) ?? [];

  await prisma.documentReview.create({
    data: {
      organizationId,
      documentId: document.id,
      reviewType,
      summary: result.summary ?? "",
      severity: result.severity ?? "low",
      suggestionsJson: { ...result, suggestions: validSuggestions },
    },
  });

  revalidatePath(`/documents/${documentId}/review`);
}
