import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { CustodianIntegrationService, type CustodianProvider } from "@/lib/services/custodian-integration.service";

/**
 * POST /api/v1/custodian/trade — Submit a trade order to a custodian
 */
export async function POST(request: Request) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "trading")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.custodian || !body.accountId || !body.ticker || !body.side || !body.quantity) {
    return NextResponse.json(
      { error: "custodian, accountId, ticker, side, and quantity are required" },
      { status: 400 },
    );
  }

  const result = await CustodianIntegrationService.submitTrade(
    auth.context.organizationId,
    body.custodian as CustodianProvider,
    body.accountId,
    body.ticker,
    body.side,
    body.quantity,
    body.orderType ?? "MARKET",
    body.limitPrice,
  );

  if (!result) {
    return NextResponse.json({ error: "Trade submission failed" }, { status: 500 });
  }

  return NextResponse.json({ data: result });
}
