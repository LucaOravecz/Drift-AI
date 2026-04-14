import { requireActiveSession } from "@/lib/auth";
import { AgentService } from "@/lib/services/agent.service";
import { AgentCommandCenterClient } from "@/components/agent-command-center-client";

export const revalidate = 0;

export default async function AgentsPage() {
  const session = await requireActiveSession();
  const organizationId = session.user.organizationId;

  const [agents, plays, workload] = await Promise.all([
    AgentService.getAll(organizationId),
    AgentService.getAutonomousWorkflowPlays(organizationId),
    AgentService.getWorkloadSummary(organizationId),
  ]);

  return <AgentCommandCenterClient agents={agents} plays={plays} workload={workload} />;
}
