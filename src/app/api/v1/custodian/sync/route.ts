import "server-only";

import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { CustodianIntegrationService } from "@/lib/services/custodian-integration.service";

/**
 * POST /api/v1/custodian/sync — Sync positions from all active custodians
 */
export async function POST() {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "integrations")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const results = await CustodianIntegrationService.syncAllPositions(auth.context.organizationId);

  return NextResponse.json({ data: results });
}
