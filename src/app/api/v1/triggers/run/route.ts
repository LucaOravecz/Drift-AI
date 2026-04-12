import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { ProactiveTriggersService } from "@/lib/services/proactive-triggers.service";

/**
 * POST /api/v1/triggers/run — Run all proactive workflow triggers
 */
export async function POST() {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "workflow")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const result = await ProactiveTriggersService.runAllTriggers(
    auth.context.organizationId,
    auth.context.userId,
  );

  return NextResponse.json({ data: result });
}
