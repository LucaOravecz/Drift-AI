import { ComplianceService } from "@/lib/services/compliance.service";
import { ComplianceClient } from "@/components/compliance-client";

export const revalidate = 0;

export default async function CompliancePage() {
  const [logs, stats, reviewQueue] = await Promise.all([
    ComplianceService.getAuditLogs(50),
    ComplianceService.getStats(),
    ComplianceService.getUnifiedReviewQueue(),
  ]);

  return (
    <ComplianceClient 
      logs={logs} 
      stats={stats} 
      reviewQueue={reviewQueue}
    />
  );
}
