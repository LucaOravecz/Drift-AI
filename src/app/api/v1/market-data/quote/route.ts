import "server-only";

import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/middleware/api-auth";
import { MarketDataService } from "@/lib/services/market-data.service";

/**
 * GET /api/v1/market-data/quote?ticker=AAPL — Get real-time quote
 */
export async function GET(request: Request) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json({ error: "ticker parameter required" }, { status: 400 });
  }

  const quote = await MarketDataService.getQuote(ticker.toUpperCase());

  if (!quote) {
    return NextResponse.json({ error: "Quote not available" }, { status: 404 });
  }

  return NextResponse.json({ data: quote });
}
