import "server-only";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { DocumentService } from "@/lib/services/document.service";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { AuditEventService } from "@/lib/services/audit-event.service";

/**
 * POST /api/documents/upload
 * Accepts multipart/form-data with fields: file (File), clientId (string)
 *
 * Processes:
 * 1. Extracts raw text if available
 * 2. Infers document type
 * 3. Persists the document record
 * 4. Builds grounded summaries plus semantic evidence chunks
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "documents_upload")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
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

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isPlainText =
      file.type === "text/plain" ||
      file.type === "text/markdown" ||
      file.name.toLowerCase().endsWith(".txt");
    if (!isPdf && !isPlainText) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload PDF or plain text." },
        { status: 415 },
      );
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

    let rawText = "";
    if (isPdf) {
      rawText = await DocumentService.extractPDFContent(fileBuffer);
    } else if (isPlainText) {
      rawText = await file.text();
    }

    // Infer document type using Claude API
    const typeInference = await DocumentService.inferDocumentType(file.name, rawText);
    const documentType = typeInference.type;

    // TODO: In production, upload file.stream() to S3/R2/GCS and store the URL
    // const s3Url = await uploadToS3(file, clientId)

    const created = await prisma.document.create({
      data: {
        clientId,
        organizationId: client.organizationId,
        householdId: null,
        fileName: file.name,
        title: file.name,
        fileSize: file.size,
        documentType,
        sourceType: "uploaded_document",
        authorityLevel: "medium",
        status: "QUEUED",
        rawText,
      },
    });

    const doc = await DocumentService.processDocument(created.id, client.organizationId, rawText);

    await AuditEventService.appendEvent({
      organizationId: client.organizationId,
      userId: auth.context.userId,
      action: "DOCUMENT_UPLOADED",
      target: `Document:${doc.id}`,
      targetId: doc.id,
      details: `Document "${file.name}" (${(file.size / 1_000_000).toFixed(2)} MB) uploaded for client ${client.name}. Type: ${documentType} (confidence: ${(typeInference.confidence * 100).toFixed(0)}%). Stored raw text length: ${rawText.length}.`,
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
      extraction: {
        summaryText: doc.summaryText,
        keyPoints: doc.keyPoints,
        actionItems: doc.actionItems,
        riskItems: doc.riskItems,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[/api/documents/upload]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
