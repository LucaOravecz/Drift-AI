import "server-only";

import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { FeeBillingService } from "@/lib/services/fee-billing.service";

/**
 * POST /api/v1/billing/batch — Run batch billing for all clients
 */
export async function POST() {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "billing")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const result = await FeeBillingService.runBatchBilling(
    auth.context.organizationId,
    periodStart,
    periodEnd,
  );

  return NextResponse.json({ data: result });
}
