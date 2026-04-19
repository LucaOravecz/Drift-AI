import { NextRequest, NextResponse } from "next/server";
import { EvalService } from "@/lib/services/eval.service";

/**
 * POST /api/evals/run
 *
 * Execute an eval run. Body:
 * {
 *   label?: string,
 *   meetingTypes?: string[],
 *   caseIds?: string[],
 *   live?: boolean,
 *   organizationId?: string
 * }
 *
 * Requires session with ADMIN role.
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Add auth check — require ADMIN role
    const body = await request.json();

    const result = await EvalService.runEvals({
      label: body.label,
      meetingTypes: body.meetingTypes,
      caseIds: body.caseIds,
      live: body.live ?? false,
      organizationId: body.organizationId,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
