import { ProactiveTriggersService } from "@/lib/services/proactive-triggers.service";
import { TriggersClient } from "@/components/triggers-client";
import { requireActiveSession } from "@/lib/auth";

export const revalidate = 0;

export default async function TriggersPage() {
  const session = await requireActiveSession();
  const summary = await ProactiveTriggersService.getTriggerSummary(session.user.organizationId);
  return <TriggersClient summary={summary as any} />;
}
