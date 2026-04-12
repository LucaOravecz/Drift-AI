import { SalesService } from "@/lib/services/sales.service";
import { SalesClient } from "@/components/sales-client";

export const revalidate = 0;

export default async function SalesPage() {
  const [prospects, campaigns, stats] = await Promise.all([
    SalesService.getProspects(),
    SalesService.getCampaigns(),
    SalesService.getStats(),
  ]);
  return <SalesClient prospects={prospects as any} campaigns={campaigns as any} stats={stats} />;
}
