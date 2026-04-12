import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { TLHSweepService } from "@/lib/services/tlh-sweep.service";

/**
 * POST /api/v1/tlh/sweep — Run a tax-loss harvesting sweep
 */
export async function POST(request: Request) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "portfolio")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  const result = await TLHSweepService.runSweep(
    auth.context.organizationId,
    auth.context.userId,
    body.constraints,
  );

  return NextResponse.json({ data: result });
}
