import "server-only";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { DocumentService } from "@/lib/services/document.service";
import { authenticateApiRequest } from "@/lib/middleware/api-auth";
import { AuditEventService } from "@/lib/services/audit-event.service";

/**
 * POST /api/documents/upload
 * Accepts multipart/form-data with fields: file (File), clientId (string)
 *
 * Processes:
 * 1. Extracts PDF content if available
 * 2. Infers document type using Claude API
 * 3. Performs intelligent extraction of key points, action items, risks
 * 4. Stores document with metadata and extracted content
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const clientId = form.get("clientId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    // Validate client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, organizationId: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (client.organizationId !== auth.context.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Extract PDF content if file is a PDF
    let pdfContent = '';
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      pdfContent = await DocumentService.extractPDFContent(fileBuffer);
    }

    // Infer document type using Claude API
    const typeInference = await DocumentService.inferDocumentType(file.name, pdfContent);
    const documentType = typeInference.type;

    // Extract key information from document
    const extraction = await DocumentService.extract(
      clientId,
      file.name,
      documentType,
      client.name,
      pdfContent
    );

    // TODO: In production, upload file.stream() to S3/R2/GCS and store the URL
    // const s3Url = await uploadToS3(file, clientId)

    const doc = await prisma.document.create({
      data: {
        clientId,
        fileName: file.name,
        fileSize: file.size,
        documentType,
        status: "SUMMARIZED", // Already processed with AI extraction
        summaryText: extraction.keyPoints.join('; '),
        keyPoints: extraction.keyPoints,
        actionItems: extraction.actionItems,
        riskItems: extraction.riskItems,
      },
    });

    await AuditEventService.appendEvent({
      organizationId: client.organizationId,
      userId: auth.context.userId,
      action: "DOCUMENT_UPLOADED",
      target: `Document:${doc.id}`,
      targetId: doc.id,
      details: `Document "${file.name}" (${(file.size / 1_000_000).toFixed(2)} MB) uploaded for client ${client.name}. Type: ${documentType} (confidence: ${(typeInference.confidence * 100).toFixed(0)}%). Extracted ${extraction.keyPoints.length} key points, ${extraction.actionItems.length} action items, ${extraction.riskItems.length} risks.`,
      severity: "INFO",
      metadata: {
        clientId: client.id,
        fileName: file.name,
        fileSize: file.size,
        documentType,
      },
    });

    return NextResponse.json({ 
      document: doc,
      inference: typeInference,
      extraction,
    }, { status: 201 });
  } catch (err) {
    console.error("[/api/documents/upload]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
