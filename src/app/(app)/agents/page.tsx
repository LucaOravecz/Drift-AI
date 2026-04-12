import { AgentCommandCenterClient } from "@/components/agent-command-center-client";
import { AgentWorkloadVisualization, AgentProductivityMetrics } from "@/components/agent-workload-visualization";
import { AgentService } from "@/lib/services/agent.service";
import prisma from "@/lib/db";

export const revalidate = 0;

export default async function AgentsPage() {
  // Get the first organization (for demo purposes)
  // In production, this would come from the authenticated user's session
  const org = await prisma.organization.findFirst();
  const organizationId = org?.id || "org-demo";

  const agents = await AgentService.getAll(organizationId);
  const workload = await AgentService.getWorkloadSummary(organizationId);

  return (
    <div className="space-y-6">
      {/* Workload visualization at the top */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Workforce Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">Real-time agent workload and productivity metrics</p>
        </div>
        
        {/* Productivity metrics cards */}
        <AgentProductivityMetrics workload={workload} />

        {/* Workload distribution visualization */}
        <AgentWorkloadVisualization workload={workload} />
      </div>

      {/* Agent Command Center */}
      <AgentCommandCenterClient agents={agents} workload={workload} />
    </div>
  );
}
