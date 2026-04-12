import { IntelligenceEngineClient } from "@/components/intelligence-engine-client";
import { DashboardService } from "@/lib/services/dashboard.service";
import { IntelligenceService } from "@/lib/services/intelligence.service";
import prisma from "@/lib/db";

export const revalidate = 0;

export default async function IntelligencePage() {
  const org = await prisma.organization.findFirst();
  const orgId = org?.id ?? "";

  const [summary, alerts, revenueDrafts, overview] = await Promise.all([
    DashboardService.getIntelligenceSummary(orgId),
    DashboardService.getPriorityAlerts(),
    DashboardService.getRevenueDrafts(),
    IntelligenceService.getEngineOverview(orgId),
  ]);

  return (
    <IntelligenceEngineClient
      summary={summary}
      alerts={alerts}
      revenueDrafts={revenueDrafts}
      overview={overview}
    />
  );
}
