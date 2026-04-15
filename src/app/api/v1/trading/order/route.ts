import "server-only";

import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { TradingOMSService } from "@/lib/services/trading-oms.service";

/**
 * POST /api/v1/trading/order — Submit a trade order
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

  try {
    const result = await TradingOMSService.submitOrder(
      {
        clientId: body.clientId,
        accountId: body.accountId,
        organizationId: auth.context.organizationId,
        ticker: body.ticker,
        side: body.side,
        orderType: body.orderType ?? "MARKET",
        quantity: body.quantity,
        limitPrice: body.limitPrice,
        timeInForce: body.timeInForce ?? "DAY",
        custodian: body.custodian ?? "SCHWAB",
        advisorId: auth.context.userId ?? "",
        reason: body.reason ?? "API order submission",
      },
      auth.context.userId ?? "",
    );

    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("read-only")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    throw err;
  }
}
