import "server-only";

import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { ProactiveTriggersService } from "@/lib/services/proactive-triggers.service";

/**
 * GET /api/v1/triggers/summary — Get trigger activity summary
 */
export async function GET() {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "read", "workflow")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const result = await ProactiveTriggersService.getTriggerSummary(auth.context.organizationId);

  return NextResponse.json({ data: result });
}
