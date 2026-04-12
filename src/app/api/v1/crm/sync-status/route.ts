import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { CRMIntegrationService } from "@/lib/services/crm-integration.service";

/**
 * GET /api/v1/crm/sync-status — Get CRM sync status
 */
export async function GET() {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "read", "integrations")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const result = await CRMIntegrationService.getSyncStatus(auth.context.organizationId);

  return NextResponse.json({ data: result });
}
