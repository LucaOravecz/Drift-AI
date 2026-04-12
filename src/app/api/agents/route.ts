import { NextResponse } from "next/server";
import { AgentService } from "@/lib/services/agent.service";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  // Get the first organization (for demo purposes)
  // In production, this would come from the authenticated user's session
  const org = await prisma.organization.findFirst();
  const organizationId = org?.id || "org-demo";

  const agents = await AgentService.getAll(organizationId);
  const workload = await AgentService.getWorkloadSummary(organizationId);

  return NextResponse.json({
    agents,
    workload,
  });
}
