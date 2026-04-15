import "server-only";

import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { IPSProposalService } from "@/lib/services/ips-proposal.service";
import { DocumentExportService } from "@/lib/services/document-export.service";

/**
 * POST /api/v1/proposals/export — Generate and download a DOCX or PDF for a proposal/IPS
 */
export async function POST(request: Request) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "documents")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.clientId || !body.format || !body.type) {
    return NextResponse.json(
      { error: "clientId, format (docx|pdf), and type (IPS|PROPOSAL) are required" },
      { status: 400 },
    );
  }

  // Generate the proposal content first
  const proposal = body.type === "IPS"
    ? await IPSProposalService.generateIPS(body.clientId, auth.context.organizationId, auth.context.userId)
    : await IPSProposalService.generateProposal(body.clientId, auth.context.organizationId, auth.context.userId);

  if (!proposal) {
    return NextResponse.json({ error: "Failed to generate proposal content" }, { status: 500 });
  }

  const docInput = {
    type: body.type === "IPS" ? "IPS" as const : "PROPOSAL" as const,
    clientName: proposal.clientName,
    organizationName: auth.context.organizationId,
    sections: proposal.sections,
    compliancePassed: proposal.complianceScanPassed,
    complianceHits: proposal.complianceHits,
    version: proposal.version,
    generatedAt: new Date(proposal.generatedAt),
    missingData: proposal.missingData,
  };

  try {
    if (body.format === "docx") {
      const result = await DocumentExportService.generateAndStoreDocx(
        docInput, body.clientId, auth.context.organizationId, auth.context.userId,
      );

      return new NextResponse(new Uint8Array(result.buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${result.fileName}"`,
        },
      });
    } else if (body.format === "pdf") {
      const result = await DocumentExportService.generateAndStorePdf(
        docInput, body.clientId, auth.context.organizationId, auth.context.userId,
      );

      return new NextResponse(new Uint8Array(result.buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${result.fileName}"`,
        },
      });
    } else {
      return NextResponse.json({ error: "Invalid format. Use 'docx' or 'pdf'." }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Document generation failed" }, { status: 500 });
  }
}
