import { TLHSweepService } from "@/lib/services/tlh-sweep.service";
import { TLHClient } from "@/components/tlh-client";
import { requireActiveSession } from "@/lib/auth";

export const revalidate = 0;

export default async function TLHPage() {
  const session = await requireActiveSession();
  const summary = await TLHSweepService.getHarvestSummary(session.user.organizationId);
  return <TLHClient summary={summary as any} />;
}
