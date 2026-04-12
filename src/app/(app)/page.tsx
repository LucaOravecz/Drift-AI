import { DashboardService } from "@/lib/services/dashboard.service";
import { DashboardClient } from "@/components/dashboard-client";

export const revalidate = 0;

export default async function Page() {
  const [metrics, alerts, revenueEngine, chartData] = await Promise.all([
    DashboardService.getExecutiveSummary(),
    DashboardService.getPriorityAlerts(),
    DashboardService.getRevenueDrafts(),
    DashboardService.getChartData(),
  ]);

  return (
    <DashboardClient
      metrics={metrics}
      alerts={alerts}
      revenueEngine={revenueEngine}
      chartData={chartData}
    />
  );
}
