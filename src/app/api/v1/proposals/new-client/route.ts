import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { IPSProposalService } from "@/lib/services/ips-proposal.service";

/**
 * POST /api/v1/proposals/new-client — Generate a new client proposal
 */
export async function POST(request: Request) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "documents")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const result = await IPSProposalService.generateProposal(
    body.clientId,
    auth.context.organizationId,
    auth.context.userId,
  );

  return NextResponse.json({ data: result });
}
