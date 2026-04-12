import "server-only";

import prisma from "@/lib/db";
import { AuditEventService } from "./audit-event.service";
import { callClaude, callClaudeStructured } from "./ai.service";
import type { FeatureRoute } from "./ai.service";

/**
 * Document Processing Pipeline
 *
 * Handles:
 * - PDF text extraction (via pdf-parse or external OCR service)
 * - AI-powered summarization and key point extraction
 * - Risk item detection
 * - Deadline extraction
 * - E-signature integration stubs (DocuSign, Adobe Sign)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExtractedContent {
  text: string;
  pageCount: number;
  confidence: number; // 0-1 OCR confidence
}

interface DocumentSummary {
  summaryText: string;
  keyPoints: string[];
  actionItems: string[];
  riskItems: string[];
  deadlines: string[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class DocumentProcessingService {
  /**
   * Process an uploaded document through the full pipeline.
   */
  static async processDocument(
    documentId: string,
    organizationId: string,
    userId?: string,
  ): Promise<DocumentSummary> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) throw new Error("Document not found");

    // Update status to processing
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "PROCESSING" },
    });

    try {
      // Step 1: Extract text (stub — integrate pdf-parse or OCR service)
      const extracted = await this.extractText(document.storagePath, document.fileName);
      await prisma.document.update({
        where: { id: documentId },
        data: { pageCount: extracted.pageCount },
      });

      // Step 2: AI summarization
      const summary = await this.summarizeDocument(
        extracted.text,
        document.documentType ?? "GENERAL",
        organizationId,
        userId,
      );

      // Step 3: Store results
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: "SUMMARIZED",
          summaryText: summary.summaryText,
          keyPoints: summary.keyPoints,
          actionItems: summary.actionItems,
          riskItems: summary.riskItems,
          deadlines: summary.deadlines,
        },
      });

      // Step 4: Audit
      await AuditEventService.appendEvent({
        organizationId,
        userId,
        action: "DOCUMENT_PROCESSED",
        target: "Document",
        targetId: documentId,
        details: `Document processed: ${document.fileName}`,
        aiInvolved: true,
        severity: "INFO",
        metadata: {
          pageCount: extracted.pageCount,
          keyPointCount: summary.keyPoints.length,
          riskCount: summary.riskItems.length,
        },
      });

      return summary;
    } catch (err) {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "UPLOADED" }, // Reset status on failure
      });

      throw err;
    }
  }

  /**
   * Extract text from a document file.
   * Stub — integrate with pdf-parse, AWS Textract, or Google Document AI.
   */
  private static async extractText(
    storagePath: string | null,
    fileName: string,
  ): Promise<ExtractedContent> {
    // TODO: Implement actual text extraction
    // Option A: pdf-parse for simple PDFs
    // Option B: AWS Textract for scanned documents (OCR)
    // Option C: Google Document AI for complex layouts

    const isPdf = fileName.toLowerCase().endsWith(".pdf");
    const isImage = /\.(jpg|jpeg|png|tiff|bmp)$/i.test(fileName);

    if (isPdf) {
      // const pdfParse = require('pdf-parse');
      // const buffer = await readFile(storagePath);
      // const data = await pdfParse(buffer);
      // return { text: data.text, pageCount: data.numpages, confidence: 1.0 };
    }

    if (isImage) {
      // Use OCR service
      // const result = await textractClient.detectDocumentText({...});
    }

    // Return empty extraction — implement with real file storage
    return { text: "", pageCount: 0, confidence: 0 };
  }

  /**
   * AI-powered document summarization.
   */
  private static async summarizeDocument(
    text: string,
    documentType: string,
    organizationId: string,
    userId?: string,
  ): Promise<DocumentSummary> {
    if (!text.trim()) {
      return {
        summaryText: "No text could be extracted from this document.",
        keyPoints: [],
        actionItems: [],
        riskItems: [],
        deadlines: [],
      };
    }

    const systemPrompt = `You are a financial document analysis engine for a wealth management platform.
Analyze the following ${documentType} document and extract:
1. A concise summary (2-3 sentences)
2. Key points (array of strings)
3. Action items the advisor should take (array of strings)
4. Risk items or compliance concerns (array of strings)
5. Deadlines or important dates (array of strings)

Return structured JSON matching the schema provided.`;

    return callClaudeStructured<DocumentSummary>(systemPrompt, text, {
      feature: "CLIENT_SUMMARY" as FeatureRoute,
      organizationId,
      userId,
      maxTokens: 2048,
      schema: {
        type: "object",
        properties: {
          summaryText: { type: "string" },
          keyPoints: { type: "array", items: { type: "string" } },
          actionItems: { type: "array", items: { type: "string" } },
          riskItems: { type: "array", items: { type: "string" } },
          deadlines: { type: "array", items: { type: "string" } },
        },
        required: ["summaryText", "keyPoints", "actionItems", "riskItems", "deadlines"],
      },
    });
  }

  // -----------------------------------------------------------------------
  // E-Signature Integration Stubs
  // -----------------------------------------------------------------------

  /**
   * Send a document for e-signature via DocuSign.
   */
  static async sendForSignature(
    documentId: string,
    organizationId: string,
    signerEmail: string,
    signerName: string,
    userId?: string,
  ): Promise<{ envelopeId: string } | null> {
    const integration = await prisma.integrationConfig.findUnique({
      where: {
        organizationId_provider: { organizationId, provider: "DOCUSIGN" },
      },
    });

    if (!integration || integration.status !== "ACTIVE") return null;

    // TODO: Implement DocuSign API calls
    // 1. Create envelope with document
    // 2. Add recipient
    // 3. Send for signature
    // 4. Store envelope ID for tracking

    await AuditEventService.appendEvent({
      organizationId,
      userId,
      action: "DOCUMENT_SENT_FOR_SIGNATURE",
      target: "Document",
      targetId: documentId,
      details: `Document sent for e-signature to ${signerEmail}`,
      severity: "INFO",
      metadata: { signerEmail, signerName },
    });

    return { envelopeId: "stub-envelope-id" };
  }

  /**
   * Handle e-signature completion webhook.
   */
  static async handleSignatureComplete(
    envelopeId: string,
    organizationId: string,
  ) {
    // TODO: Download signed document from DocuSign
    // TODO: Store signed version alongside original
    // TODO: Update document status

    await AuditEventService.appendEvent({
      organizationId,
      action: "DOCUMENT_SIGNED",
      target: "E-Signature Envelope",
      targetId: envelopeId,
      details: `Document signing completed for envelope ${envelopeId}`,
      severity: "INFO",
    });
  }
}
