import "server-only";

import { NextResponse } from "next/server";
import { NewsService } from "@/lib/services/news.service";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";

export async function GET() {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "read", "news")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const [signals, events] = await Promise.all([
      Promise.resolve(NewsService.getLatestSignals()),
      NewsService.runNewsOracle(auth.context.organizationId),
    ]);

    return NextResponse.json({ signals, events });
  } catch (error) {
    console.error("[NewsAPI]", error);
    return NextResponse.json({ error: "News Oracle failed" }, { status: 500 });
  }
}
