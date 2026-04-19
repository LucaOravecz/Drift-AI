import { NextRequest, NextResponse } from "next/server";
import { EvalService } from "@/lib/services/eval.service";

/**
 * GET /api/evals/runs
 *
 * List eval run history. Query params:
 * - limit: number (default 20)
 */
export async function GET(request: NextRequest) {
  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
  const runs = await EvalService.getRunHistory(limit);
  return NextResponse.json(runs);
}
