import "server-only";

import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { PortfolioRebalancingService } from "@/lib/services/portfolio-rebalancing.service";

/**
 * POST /api/v1/portfolio/rebalance — Generate rebalancing trades for a client
 */
export async function POST(request: Request) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "portfolio")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();

  const result = await PortfolioRebalancingService.generateRebalanceTrades(
    body.clientId,
    auth.context.organizationId,
    body.model,
    {
      lotMethod: body.lotMethod ?? "TAX_LOT",
      avoidWashSales: body.avoidWashSales ?? true,
      userId: auth.context.userId,
    },
  );

  return NextResponse.json({ data: result });
}
