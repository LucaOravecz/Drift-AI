import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import prisma from "@/lib/db";
import { RoiReportExportService } from "@/lib/services/roi-report-export.service";

async function handleExport() {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "documents")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const organization = await prisma.organization.findUnique({
    where: { id: auth.context.organizationId },
    select: { name: true },
  });

  const user = auth.context.userId
    ? await prisma.user.findUnique({
        where: { id: auth.context.userId },
        select: { name: true, email: true },
      })
    : null;

  const result = await RoiReportExportService.generatePdf({
    organizationName: organization?.name ?? "Drift AI",
    orgId: auth.context.organizationId,
    generatedBy: user?.name ?? user?.email ?? "Drift user",
  });

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
    },
  });
}

export async function GET() {
  return handleExport();
}

export async function POST() {
  return handleExport();
}
