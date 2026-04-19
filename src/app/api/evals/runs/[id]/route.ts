import { NextRequest, NextResponse } from "next/server";
import { EvalService } from "@/lib/services/eval.service";

/**
 * GET /api/evals/runs/[id]
 *
 * Get detailed results for a specific eval run.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const results = await EvalService.getRunResults(id);
  if (!results.length) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  return NextResponse.json(results);
}
