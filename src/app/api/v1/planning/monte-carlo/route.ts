import "server-only";

import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { FinancialPlanningService } from "@/lib/services/financial-planning.service";

/**
 * POST /api/v1/planning/monte-carlo — Run Monte Carlo retirement simulation
 */
export async function POST(request: Request) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "planning")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();

  const result = FinancialPlanningService.runMonteCarlo(
    body,
    body.trials ?? 10000,
    body.targetSuccessRate ?? 0.9,
  );

  return NextResponse.json({ data: result });
}
