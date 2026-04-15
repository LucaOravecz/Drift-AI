import "server-only";

import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { TLHSweepService } from "@/lib/services/tlh-sweep.service";

/**
 * GET /api/v1/tlh/summary — Get current TLH harvest summary
 */
export async function GET() {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "read", "portfolio")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const result = await TLHSweepService.getHarvestSummary(auth.context.organizationId);

  return NextResponse.json({ data: result });
}
