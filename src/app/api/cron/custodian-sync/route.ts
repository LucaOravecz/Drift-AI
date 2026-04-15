import "server-only";

import { NextResponse } from "next/server";
import { CustodianIntegrationService } from "@/lib/services/custodian-integration.service";

/**
 * POST /api/cron/custodian-sync — Sync positions from all active custodians
 * Protected by CRON_SECRET
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const organizationId = body.organizationId as string;

  if (!organizationId) {
    return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  }

  const results = await CustodianIntegrationService.syncAllPositions(organizationId);

  return NextResponse.json({ success: true, results });
}
