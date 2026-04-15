import "server-only";

import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import prisma from "@/lib/db";

/**
 * GET /api/v1/admin/clients/:id/export — JSON bundle for portability / e-discovery prep.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "read", "admin_export")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id: clientId } = await params;

  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: auth.context.organizationId },
    include: {
      intelligence: true,
      accounts: { include: { holdings: true } },
      meetings: { orderBy: { scheduledAt: "desc" }, take: 50 },
      tasks: { orderBy: { createdAt: "desc" }, take: 100 },
      communications: { orderBy: { timestamp: "desc" }, take: 50 },
      documents: { orderBy: { uploadedAt: "desc" }, take: 50 },
      opportunities: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const exportedAt = new Date().toISOString();

  return NextResponse.json({
    exportedAt,
    schemaVersion: 1,
    organizationId: auth.context.organizationId,
    client,
  });
}
