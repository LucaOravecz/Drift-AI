import "server-only";

import { NextResponse } from "next/server";
import { AgentService } from "@/lib/services/agent.service";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "read", "agents")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const organizationId = auth.context.organizationId;
  const agents = await AgentService.getAll(organizationId);
  const workload = await AgentService.getWorkloadSummary(organizationId);

  return NextResponse.json({
    agents,
    workload,
  });
}
