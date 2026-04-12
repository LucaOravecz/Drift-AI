import { NextResponse } from "next/server";
import { AgentService } from "@/lib/services/agent.service";
import { authenticateApiRequest } from "@/lib/middleware/api-auth";
import { getActiveSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  // Try session auth first (browser requests), then API key
  const session = await getActiveSession();
  if (!session) {
    const auth = await authenticateApiRequest();
    if (!auth.authenticated || !auth.context) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
    }
    const agents = await AgentService.getAll(auth.context.organizationId);
    const workload = await AgentService.getWorkloadSummary(auth.context.organizationId);
    return NextResponse.json({ agents, workload });
  }

  const organizationId = session.user.organizationId;
  const agents = await AgentService.getAll(organizationId);
  const workload = await AgentService.getWorkloadSummary(organizationId);

  return NextResponse.json({
    agents,
    workload,
  });
}
