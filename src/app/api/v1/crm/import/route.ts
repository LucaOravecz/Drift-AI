import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { CRMIntegrationService } from "@/lib/services/crm-integration.service";

/**
 * POST /api/v1/crm/import — Import contacts from active CRM providers
 */
export async function POST() {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "integrations")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const results = await CRMIntegrationService.importContacts(
    auth.context.organizationId,
    auth.context.userId,
  );

  return NextResponse.json({ data: results });
}
