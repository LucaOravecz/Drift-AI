import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import { DocumentReviewer } from "@/components/document-reviewer";
import { requireActiveSession } from "@/lib/auth";

export default async function DocumentReviewPage({ params }: { params: { id: string } }) {
  const session = await requireActiveSession();

  const document = await prisma.document.findUnique({
    where: { 
      id: params.id,
      organizationId: session.user.organizationId
    },
  });

  if (!document) notFound();

  // Load the most recent review
  const latestReview = await prisma.documentReview.findFirst({
    where: { documentId: document.id },
    orderBy: { createdAt: 'desc' }
  });

  // If no review exists, we gracefully handle it by instructing the UI to prompt for one or we mock the empty state
  if (!latestReview) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] gap-4">
        <h2 className="text-xl font-semibold">No Review Found</h2>
        <p className="text-sm text-muted-foreground max-w-md text-center">This document has not been reviewed yet. Trigger a compliance review to generate line-level suggestions.</p>
        <form action={async () => {
          "use server";
          const { callReviewEndpoint } = await import("@/lib/services/document-review-actions");
          await callReviewEndpoint(document.id, session.user.organizationId);
        }}>
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            Start Review
          </button>
        </form>
      </div>
    );
  }

  const { suggestions, summary, severity } = latestReview.suggestionsJson as any;

  return (
    <DocumentReviewer 
      documentId={document.id}
      rawText={document.rawText || ""}
      summary={latestReview.summary || summary || "Document review complete."}
      severity={latestReview.severity || severity || "low"}
      suggestions={suggestions || []}
    />
  );
}
