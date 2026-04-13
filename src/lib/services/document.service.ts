import prisma from '../db'
import { callClaudeJSON } from './ai.service'

/**
 * Document Service
 *
 * Document processing pipeline states:
 *   UPLOADED → QUEUED → PROCESSING → SUMMARIZED → REVIEWED
 *
 * RULES:
 * 1. PDF extraction now uses Claude API for intelligent content parsing
 * 2. Document TYPE and FILENAME inform the analysis context
 * 3. All extractions are labeled with their source (AI-extracted, manual, metadata-based)
 * 4. Processing status transitions reflect actual workflow state
 * 5. summaryText, keyPoints, and actionItems are grounded in document content when extracted
 * 6. Falls back to metadata-based analysis if PDF content unavailable or AI extraction fails
 */
export class DocumentService {
  /**
   * Extracts content from a document using Claude API.
   * Returns structured data about the document's key information.
   * Falls back gracefully if PDF content is unavailable.
   */
  private static async extractDocumentContent(
    fileName: string,
    documentType: string,
    clientName: string,
    documentContent: string | undefined,
    orgId: string
  ): Promise<{
    keyPoints: string[]
    actionItems: string[]
    riskItems: string[]
    extractionSource: string
  }> {
    // If no actual document content provided, fall back to type-based checklist
    if (!documentContent) {
      return DocumentService.getTypeBasedChecklist(fileName, documentType, clientName)
    }

    try {
      const systemPrompt = `You are a financial document analyst. Extract key information, action items, and risks from the provided document.

Return ONLY valid JSON with this structure:
{
  "keyPoints": ["fact 1", "fact 2", ...],
  "actionItems": ["action 1", "action 2", ...],
  "riskItems": ["risk 1", "risk 2", ...]
}`

      const userMessage = `Analyze this ${documentType} document for client "${clientName}":

${documentContent}

Extract 3-5 key facts, 3-5 action items, and 2-3 risks. Be specific to the actual content.`

      const result = await callClaudeJSON<{
        keyPoints: string[]
        actionItems: string[]
        riskItems: string[]
      }>(systemPrompt, userMessage, { maxTokens: 2048, organizationId: orgId })

      return {
        keyPoints: (result.keyPoints ?? []).slice(0, 5),
        actionItems: (result.actionItems ?? []).slice(0, 5),
        riskItems: (result.riskItems ?? []).slice(0, 3),
        extractionSource: 'AI_EXTRACTED_FROM_CONTENT',
      }
    } catch (err) {
      console.warn('[DocumentService] AI extraction failed, falling back to type-based checklist:', err)
      return DocumentService.getTypeBasedChecklist(fileName, documentType, clientName)
    }
  }

  private static getTypeBasedChecklist(
    fileName: string,
    documentType: string,
    clientName: string
  ): {
    keyPoints: string[]
    actionItems: string[]
    riskItems: string[]
    extractionSource: string
  } {
    const docTypeLabel = documentType ? documentType.replace(/_/g, ' ').toLowerCase() : 'document'

    const typeChecklistMap: Record<
      string,
      { keyPoints: string[]; actionItems: string[]; riskItems: string[] }
    > = {
      TRUST_AGREEMENT: {
        keyPoints: [
          `Document type: Trust Agreement`,
          `Client: ${clientName}`,
          `File: ${fileName}`,
          `Analysis: Review for trustee and beneficiary designations`,
        ],
        actionItems: [
          'Verify trustee designations are current',
          'Confirm successor trustee information',
          'Review distribution provisions',
          'Verify beneficiary designations',
        ],
        riskItems: [
          'Outdated trustee designations may create administrative issues',
          'Missing or ambiguous distribution language should be flagged for legal review',
        ],
      },
      TAX_RETURN: {
        keyPoints: [
          `Document type: Tax Return`,
          `Client: ${clientName}`,
          `File: ${fileName}`,
          `Analysis: Review for income, deductions, and tax planning opportunities`,
        ],
        actionItems: [
          'Verify AGI against planning assumptions',
          'Review capital gains/losses for harvesting opportunities',
          'Check retirement contribution amounts',
          'Review any carryforward losses (Schedule D)',
        ],
        riskItems: ['Changes in income may affect tax planning strategies'],
      },
      ESTATE_PLAN: {
        keyPoints: [
          `Document type: Estate Plan`,
          `Client: ${clientName}`,
          `File: ${fileName}`,
          `Analysis: Review for alignment with current family and financial situation`,
        ],
        actionItems: [
          'Verify beneficiary designations are current',
          'Confirm executor/trustee information',
          'Check for any changes in family circumstances requiring updates',
        ],
        riskItems: ['Outdated estate plans may not reflect current family or asset situation'],
      },
      FINANCIAL_PLAN: {
        keyPoints: [
          `Document type: Financial Plan`,
          `Client: ${clientName}`,
          `File: ${fileName}`,
          `Analysis: Verify planning assumptions remain valid`,
        ],
        actionItems: [
          'Verify assumptions remain current (income, retirement date, return assumptions)',
          'Review against most recent portfolio data',
        ],
        riskItems: ['Financial plans require regular updates as circumstances change'],
      },
      STATEMENT: {
        keyPoints: [
          `Document type: Account Statement`,
          `Client: ${clientName}`,
          `File: ${fileName}`,
          `Analysis: Reconcile with internal records`,
        ],
        actionItems: [
          'Reconcile with internal account records',
          'Review for unexpected transactions or balance changes',
        ],
        riskItems: [],
      },
    }

    const typeKey = documentType ?? ''
    const checklist = typeChecklistMap[typeKey] ?? {
      keyPoints: [
        `Document type: ${docTypeLabel}`,
        `Client: ${clientName}`,
        `File: ${fileName}`,
      ],
      actionItems: ['Review document contents with client', 'Confirm document is current and complete'],
      riskItems: [],
    }

    return {
      ...checklist,
      extractionSource: 'METADATA_BASED_CHECKLIST',
    }
  }

  static async getDocuments() {
    return prisma.document.findMany({
      include: { client: true },
      orderBy: { uploadedAt: 'desc' },
    })
  }

  static async getDocument(id: string) {
    return prisma.document.findUnique({
      where: { id },
      include: { client: true },
    })
  }

  static async getStats() {
    const [total, summarized, processing, reviewed] = await Promise.all([
      prisma.document.count(),
      prisma.document.count({ where: { status: 'SUMMARIZED' } }),
      prisma.document.count({ where: { status: { in: ['PROCESSING', 'QUEUED'] } } }),
      prisma.document.count({ where: { status: 'REVIEWED' } }),
    ])
    return { total, summarized, processing, reviewed }
  }

  /**
   * Processes a document through the pipeline.
   *
   * Layer 1 (DETERMINISTIC): Extract from metadata
   *   - Document type and filename inform analysis context
   *   - Standard review checklists applied
   *
   * Layer 2 (AI ASSISTED): If document content available, use Claude API to:
   *   - Extract actual facts from the document
   *   - Identify specific action items and risks
   *   - Provide intelligent analysis beyond type-based checklists
   *
   * Fallback: If AI extraction fails, deterministic checklist is used.
   */
  static async processDocument(id: string, orgId: string, documentContent?: string) {
    const doc = await prisma.document.findUnique({
      where: { id },
      include: { client: true },
    })
    if (!doc) throw new Error('Document not found')

    await prisma.document.update({
      where: { id },
      data: { status: 'PROCESSING' },
    })

    const docTypeLabel = doc.documentType
      ? doc.documentType.replace(/_/g, ' ').toLowerCase()
      : 'document'

    // Extract content with AI if available, fall back to metadata-based checklist
    const extraction = await DocumentService.extractDocumentContent(
      doc.fileName,
      doc.documentType ?? '',
      doc.client.name,
      documentContent,
      orgId
    )

    const summary =
      extraction.extractionSource === 'AI_EXTRACTED_FROM_CONTENT'
        ? `Document "${doc.fileName}" (${docTypeLabel}) has been analyzed using AI extraction. Key findings and action items are listed below.`
        : `Document "${doc.fileName}" (${docTypeLabel}) has been processed using type-based review checklist. Full content analysis would require document content to be provided.`

    await prisma.document.update({
      where: { id },
      data: {
        status: 'SUMMARIZED',
        summaryText: summary,
        keyPoints: JSON.stringify(extraction.keyPoints),
        actionItems: JSON.stringify(extraction.actionItems),
        riskItems: JSON.stringify(extraction.riskItems),
        sourceRef: extraction.extractionSource,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'DOCUMENT_PROCESSED',
        target: doc.client.name,
        details: `Document "${doc.fileName}" processed via ${extraction.extractionSource}. Document type: ${doc.documentType || 'unknown'}`,
        aiInvolved: extraction.extractionSource.includes('AI'),
        severity: 'INFO',
      },
    })

    return { status: 'SUMMARIZED' }
  }

  static statusBadge(status: string) {
    const map: Record<string, string> = {
      UPLOADED: 'outline',
      QUEUED: 'secondary',
      PROCESSING: 'secondary',
      SUMMARIZED: 'default',
      REVIEWED: 'outline',
    }
    return map[status] ?? 'outline'
  }

  static parseJson(str: string | null): string[] {
    if (!str) return []
    try {
      return JSON.parse(str) as string[]
    } catch {
      return [str]
    }
  }

  /**
   * Extract text content from a PDF file buffer using pdf-parse
   */
  static async extractPDFContent(fileBuffer: Buffer): Promise<string> {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(fileBuffer);
      
      // Extract text from all pages, with page breaks
      const text = data.text || '';
      return text.trim().substring(0, 10000); // Limit to 10k chars for API
    } catch (err) {
      console.warn('[DocumentService] PDF extraction failed:', err);
      return '';
    }
  }

  /**
   * Infer document type using Claude API from filename and/or content
   */
  static async inferDocumentType(
    fileName: string,
    content?: string
  ): Promise<{
    type: string;
    confidence: number;
    reasoning: string;
  }> {
    try {
      const systemPrompt = `You are a document classification expert. Analyze the filename and content to determine the document type.

Return ONLY valid JSON:
{
  "type": "ESTATE_PLAN|TAX_RETURN|STATEMENT|INSURANCE|FINANCIAL_PLAN|CORRESPONDENCE|CONTRACT|OTHER",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

      const contentContext = content ? `Content preview:\n${content.substring(0, 500)}\n\n` : '';
      const userMessage = `Classify this document:

Filename: ${fileName}
${contentContext}
What document type is this most likely to be?`;

      const result = await callClaudeJSON<{
        type: string;
        confidence: number;
        reasoning: string;
      }>(systemPrompt, userMessage, { maxTokens: 256, organizationId: 'system' });

      return {
        type: result.type || 'OTHER',
        confidence: Math.min(1, Math.max(0, result.confidence ?? 0.5)),
        reasoning: result.reasoning || 'Could not determine',
      };
    } catch (err) {
      console.warn('[DocumentService] Type inference failed:', err);
      return {
        type: 'OTHER',
        confidence: 0,
        reasoning: 'Inference failed, defaulting to OTHER',
      };
    }
  }

  /**
   * Extract information from document content (used during upload)
   * Returns extraction results without updating database
   */
  static async extract(
    clientId: string,
    fileName: string,
    documentType: string,
    clientName: string,
    documentContent?: string
  ): Promise<{
    keyPoints: string[]
    actionItems: string[]
    riskItems: string[]
  }> {
    const extraction = await DocumentService.extractDocumentContent(
      fileName,
      documentType,
      clientName,
      documentContent,
      'system'
    )
    
    return {
      keyPoints: extraction.keyPoints,
      actionItems: extraction.actionItems,
      riskItems: extraction.riskItems,
    }
  }
}
