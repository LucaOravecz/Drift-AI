import "server-only";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { DOCUMENT_REVIEW_SYSTEM, buildReviewPrompt, type ReviewType } from "@/lib/prompts/document-review";
import { callClaudeJSON } from "@/lib/services/ai.service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest();
    if (!auth.authenticated || !auth.context) {
      return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: auth.statusCode ?? 401 });
    }

    if (!hasPermission(auth.context, "write", "documents")) {
      return NextResponse.json({ error: "Insufficient permissions to review documents." }, { status: 403 });
    }

    const { documentId, reviewType } = await request.json() as { documentId?: string, reviewType?: ReviewType };

    if (!documentId || !reviewType) {
      return NextResponse.json({ error: "documentId and reviewType are required." }, { status: 400 });
    }

    const document = await prisma.document.findUnique({
      where: {
        id: documentId,
        organizationId: auth.context.organizationId,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    if (!document.rawText || document.rawText.trim() === "") {
      return NextResponse.json({ error: "Document has no text parsed yet. Please wait for OCR to complete." }, { status: 400 });
    }

    const prompt = buildReviewPrompt(document.rawText, reviewType);

    // Call Claude for structured JSON review
    const result = await callClaudeJSON<{
      summary: string;
      severity: string;
      suggestions: any[];
    }>(DOCUMENT_REVIEW_SYSTEM, prompt, {
      organizationId: auth.context.organizationId,
    });

    // Validate and sanitize the originalText against rawText
    const validSuggestions = result.suggestions?.filter((s) => {
      if (!s.originalText) return false;
      // Exact match check
      const indexOf = document.rawText!.indexOf(s.originalText);
      if (indexOf === -1) {
        console.warn(`[DocumentReview] Suggestion dropped, hallucinated text: "${s.originalText.substring(0, 50)}..."`);
        return false;
      }
      return true;
    }) ?? [];

    const finalJson = {
      ...result,
      suggestions: validSuggestions,
    };

    const review = await prisma.documentReview.create({
      data: {
        organizationId: auth.context.organizationId,
        documentId: document.id,
        reviewType: reviewType,
        summary: result.summary ?? "",
        severity: result.severity ?? "low",
        suggestionsJson: finalJson,
        reviewerId: auth.context.userId,
      },
    });

    return NextResponse.json({ review });
  } catch (err: any) {
    console.error("[DocumentsReviewRoute] Error generating review:", err);
    return NextResponse.json({ error: err.message || "Failed to generate review" }, { status: 500 });
  }
}
