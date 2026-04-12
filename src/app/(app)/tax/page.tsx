import { TaxService } from "@/lib/services/tax.service";
import { TaxClient } from "@/components/tax-client";

export const revalidate = 0;

export default async function TaxIntelligencePage() {
  const [insights, stats] = await Promise.all([
    TaxService.getTaxInsights(),
    TaxService.getStats(),
  ]);
  return <TaxClient insights={insights as any} stats={stats} />;
}
