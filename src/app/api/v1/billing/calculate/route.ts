import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { FeeBillingService } from "@/lib/services/fee-billing.service";

/**
 * POST /api/v1/billing/calculate — Calculate fee for a client
 */
export async function POST(request: Request) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "billing")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const periodStart = body.periodStart ? new Date(body.periodStart) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const periodEnd = body.periodEnd ? new Date(body.periodEnd) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

  const result = await FeeBillingService.calculateFee(
    body.clientId,
    periodStart,
    periodEnd,
  );

  return NextResponse.json({ data: result });
}
