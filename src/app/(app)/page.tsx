import { DashboardService } from "@/lib/services/dashboard.service";
import { DashboardClient } from "@/components/dashboard-client";
import { isDatabaseConnectionError } from "@/lib/is-database-connection-error";

export const revalidate = 0;

const OFFLINE_METRICS = {
  aum: "No data",
  aumChange: "Connect Postgres to load live metrics",
  activeClients: 0,
  prospects: 0,
  revenueOpportunities: "$0",
  churnRisk: 0,
  taxReviewPending: 0,
  meetingsThisWeek: 0,
  tasksDue: 0,
  complianceFlags: 0,
};

export default async function Page() {
  let metrics = OFFLINE_METRICS;
  let alerts: Awaited<ReturnType<typeof DashboardService.getPriorityAlerts>> = [];
  let revenueEngine: Awaited<ReturnType<typeof DashboardService.getRevenueDrafts>> = [];
  let chartData: Awaited<ReturnType<typeof DashboardService.getChartData>> = [];
  let offlineNotice: string | null = null;

  try {
    [metrics, alerts, revenueEngine, chartData] = await Promise.all([
      DashboardService.getExecutiveSummary(),
      DashboardService.getPriorityAlerts(),
      DashboardService.getRevenueDrafts(),
      DashboardService.getChartData(),
    ]);
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error;
    offlineNotice =
      "Database unreachable (e.g. Postgres not running on 127.0.0.1:5432). Start it with `npm run db:start` then `npm run db:migrate:local` and `npm run db:seed:local`, or set DATABASE_URL to a reachable instance.";
  }

  return (
    <DashboardClient
      metrics={metrics}
      alerts={alerts}
      revenueEngine={revenueEngine}
      chartData={chartData}
      offlineNotice={offlineNotice}
    />
  );
}
