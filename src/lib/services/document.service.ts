import { randomUUID } from "node:crypto";

import type { Document } from "@prisma/client";
import { Prisma } from "@prisma/client";
import prisma from "../db";
import { semanticChunkVaultDocument } from "@/lib/vault/document-semantic-chunk";
import type { VaultChunkStoredMetadata } from "@/lib/retrieval/types";
import { callClaudeJSON } from "./ai.service";

interface DocumentExtractionResult {
  summaryText: string | null;
  keyPoints: string[];
  actionItems: string[];
  riskItems: string[];
  warnings: string[];
  extractionSource: string;
}

function normalizeWhitespace(text: string) {
  return text.replace(/\r/g, "\n").replace(/\t/g, " ").replace(/\u0000/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function estimateTokenCount(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.35);
}

export class DocumentService {
  private static inferSourceType(documentType: string | null | undefined) {
    const type = documentType ?? "OTHER";

    const sourceMap: Record<string, string> = {
      ESTATE_PLAN: "estate_plan",
      TAX_RETURN: "tax_document",
      STATEMENT: "portfolio_snapshot",
      TRUST_AGREEMENT: "ips_document",
      INSURANCE: "client_document",
      FINANCIAL_PLAN: "planning_document",
      CORRESPONDENCE: "crm_note",
      CONTRACT: "firm_document",
      OTHER: "uploaded_document",
    };

    return sourceMap[type] ?? "uploaded_document";
  }

  private static inferAuthorityLevel(documentType: string | null | undefined) {
    switch (documentType) {
      case "TRUST_AGREEMENT":
      case "ESTATE_PLAN":
        return "high";
      case "TAX_RETURN":
      case "STATEMENT":
      case "FINANCIAL_PLAN":
        return "medium";
      default:
        return "medium";
    }
  }

  private static parseTags(tags: Prisma.JsonValue | null | undefined): string[] {
    if (tags == null) return [];
    if (Array.isArray(tags)) return tags.map((t) => String(t));
    if (typeof tags === "string") {
      try {
        const parsed = JSON.parse(tags) as unknown;
        return Array.isArray(parsed) ? parsed.map(String) : [tags];
      } catch {
        return [tags];
      }
    }
    return [];
  }

  private static async extractGroundedContent(params: {
    fileName: string;
    documentType: string;
    clientName: string;
    documentContent?: string;
    organizationId: string;
  }): Promise<DocumentExtractionResult> {
    const text = normalizeWhitespace(params.documentContent ?? "");
    if (!text) {
      return {
        summaryText: null,
        keyPoints: [],
        actionItems: [],
        riskItems: [],
        warnings: ["No extractable text was stored for this document."],
        extractionSource: "NO_TEXT_EXTRACTED",
      };
    }

    try {
      const systemPrompt = `You analyze advisor documents for meeting preparation.

STRICT RULES:
1. Use only facts directly supported by the provided text.
2. Prefer omission over inference.
3. If a date is unclear, leave it blank.
4. Do not invent action items from the filename or document type.
5. Return JSON only.`;

      const userMessage = `Document file: ${params.fileName}
Document type: ${params.documentType}
Client: ${params.clientName}

Document text:
${text.slice(0, 18000)}`;

      const result = await callClaudeJSON<{
        summaryText?: string | null;
        keyPoints?: string[];
        actionItems?: string[];
        riskItems?: string[];
        warnings?: string[];
      }>(systemPrompt, userMessage, {
        maxTokens: 1600,
        organizationId: params.organizationId,
      });

      return {
        summaryText: result.summaryText?.trim() || null,
        keyPoints: (result.keyPoints ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 6),
        actionItems: (result.actionItems ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 6),
        riskItems: (result.riskItems ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 6),
        warnings: (result.warnings ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 4),
        extractionSource: "AI_GROUNDED_EXTRACTION",
      };
    } catch (err) {
      console.warn("[DocumentService] grounded extraction failed:", err);
      return {
        summaryText: null,
        keyPoints: [],
        actionItems: [],
        riskItems: [],
        warnings: ["Automated extraction failed; review the stored text directly."],
        extractionSource: "EXTRACTION_FAILED",
      };
    }
  }

  private static async rebuildChunks(
    doc: Document & { client: { id: string; householdId: string | null } },
    rawText: string,
    organizationId: string,
  ): Promise<{ sectionPath: string; text: string }[]> {
    const displayTitle = doc.title ?? doc.fileName;
    const chunks = semanticChunkVaultDocument(rawText, displayTitle);

    await prisma.documentChunk.deleteMany({
      where: { documentId: doc.id },
    });

    if (chunks.length === 0) return [];

    const createdAtIso = new Date().toISOString();
    const householdId = doc.householdId ?? doc.client.householdId ?? null;

    await prisma.documentChunk.createMany({
      data: chunks.map((chunk, index) => {
        const id = randomUUID();
        const meta: VaultChunkStoredMetadata = {
          chunk_id: id,
          document_id: doc.id,
          tenant_id: organizationId,
          client_id: doc.clientId,
          source_name: displayTitle,
          source_type: doc.sourceType ?? this.inferSourceType(doc.documentType),
          document_type: doc.documentType ?? null,
          authority_tier: doc.authorityLevel ?? this.inferAuthorityLevel(doc.documentType),
          jurisdiction: doc.jurisdiction ?? null,
          effective_date: doc.effectiveDate?.toISOString() ?? null,
          publication_date: doc.uploadedAt.toISOString(),
          created_at: createdAtIso,
          source_url: doc.storagePath ?? null,
          title: displayTitle,
          headings: chunk.headings,
          tags: this.parseTags(doc.tags),
          boundary_type: chunk.boundary_type,
        };

        return {
          id,
          documentId: doc.id,
          organizationId,
          householdId,
          sectionPath: chunk.sectionPath,
          text: chunk.text,
          tokenCount: estimateTokenCount(chunk.text),
          keywordText: `${chunk.sectionPath} ${chunk.headings.join(" ")} ${chunk.text}`.toLowerCase(),
          citationLabel: `${displayTitle} · ${index + 1}`,
          metadataJson: meta as unknown as Prisma.InputJsonValue,
        };
      }),
    });

    return chunks.map((c) => ({ sectionPath: c.sectionPath, text: c.text }));
  }

  static async getDocuments() {
    return prisma.document.findMany({
      include: { client: true },
      orderBy: { uploadedAt: "desc" },
    });
  }

  static async getDocument(id: string) {
    return prisma.document.findUnique({
      where: { id },
      include: { client: true },
    });
  }

  static async getStats() {
    const [total, summarized, processing, reviewed] = await Promise.all([
      prisma.document.count(),
      prisma.document.count({ where: { status: "SUMMARIZED" } }),
      prisma.document.count({ where: { status: { in: ["PROCESSING", "QUEUED"] } } }),
      prisma.document.count({ where: { status: "REVIEWED" } }),
    ]);
    return { total, summarized, processing, reviewed };
  }

  static async processDocument(id: string, organizationId: string, documentContent?: string) {
    const doc = await prisma.document.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!doc) throw new Error("Document not found");

    const rawText = normalizeWhitespace(documentContent ?? doc.rawText ?? "");
    const sourceType = doc.sourceType ?? this.inferSourceType(doc.documentType);
    const authorityLevel = doc.authorityLevel ?? this.inferAuthorityLevel(doc.documentType);
    const title = doc.title ?? doc.fileName;
    const householdId = doc.householdId ?? doc.client.householdId ?? null;

    await prisma.document.update({
      where: { id },
      data: {
        status: "PROCESSING",
        organizationId,
        householdId,
        title,
        sourceType,
        authorityLevel,
        rawText,
      },
    });

    const extraction = await this.extractGroundedContent({
      fileName: doc.fileName,
      documentType: doc.documentType ?? "OTHER",
      clientName: doc.client.name,
      documentContent: rawText,
      organizationId,
    });

    const parsedSections = await this.rebuildChunks(doc, rawText, organizationId);

    const updated = await prisma.document.update({
      where: { id },
      data: {
        organizationId,
        householdId,
        title,
        sourceType,
        authorityLevel,
        status: rawText ? "SUMMARIZED" : "UPLOADED",
        summaryText: extraction.summaryText,
        keyPoints: extraction.keyPoints,
        actionItems: extraction.actionItems,
        riskItems: extraction.riskItems,
        sourceRef: extraction.extractionSource,
        rawText,
        parsedSections: parsedSections as unknown as Prisma.InputJsonValue,
        metadataJson: {
          warnings: extraction.warnings,
          chunkCount: parsedSections.length,
        },
      },
      include: { client: true },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        action: "DOCUMENT_PROCESSED",
        target: doc.client.name,
        details: `Document "${doc.fileName}" processed with ${parsedSections.length} stored evidence chunk(s).`,
        aiInvolved: extraction.extractionSource === "AI_GROUNDED_EXTRACTION",
        severity: "INFO",
      },
    });

    return updated;
  }

  static statusBadge(status: string) {
    const map: Record<string, string> = {
      UPLOADED: "outline",
      QUEUED: "secondary",
      PROCESSING: "secondary",
      SUMMARIZED: "default",
      REVIEWED: "outline",
    };
    return map[status] ?? "outline";
  }

  static parseJson(value: string | string[] | null): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      return JSON.parse(value) as string[];
    } catch {
      return [value];
    }
  }

  static async extractPDFContent(fileBuffer: Buffer): Promise<string> {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
      const textResult = await parser.getText();
      await parser.destroy();
      return normalizeWhitespace((textResult.text ?? "").slice(0, 50000));
    } catch (err) {
      console.warn("[DocumentService] PDF extraction failed:", err);
      return "";
    }
  }

  static async inferDocumentType(fileName: string, content?: string) {
    try {
      const systemPrompt = `You classify advisor documents.

Return JSON only:
{
  "type": "ESTATE_PLAN|TAX_RETURN|STATEMENT|INSURANCE|FINANCIAL_PLAN|CORRESPONDENCE|CONTRACT|OTHER",
  "confidence": 0.0,
  "reasoning": "brief explanation"
}`;

      const result = await callClaudeJSON<{
        type: string;
        confidence: number;
        reasoning: string;
      }>(systemPrompt, `Filename: ${fileName}\n\nPreview:\n${(content ?? "").slice(0, 1000)}`, {
        maxTokens: 256,
        organizationId: "system",
      });

      return {
        type: result.type || "OTHER",
        confidence: Math.min(1, Math.max(0, result.confidence ?? 0.5)),
        reasoning: result.reasoning || "Could not determine document type.",
      };
    } catch (err) {
      console.warn("[DocumentService] Type inference failed:", err);
      return {
        type: "OTHER",
        confidence: 0,
        reasoning: "Inference failed, defaulting to OTHER",
      };
    }
  }

  static async extract(
    clientId: string,
    fileName: string,
    documentType: string,
    clientName: string,
    documentContent?: string,
  ) {
    const extraction = await this.extractGroundedContent({
      fileName,
      documentType,
      clientName,
      documentContent,
      organizationId: "system",
    });

    return {
      clientId,
      keyPoints: extraction.keyPoints,
      actionItems: extraction.actionItems,
      riskItems: extraction.riskItems,
      summaryText: extraction.summaryText,
      warnings: extraction.warnings,
    };
  }
}
