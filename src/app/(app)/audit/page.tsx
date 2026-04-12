import { Suspense } from "react";
import prisma from "@/lib/db";
import { AuditExplorerClient } from "@/components/audit-explorer-client";

export const metadata = {
  title: "Audit Ledger | DRIFT OS",
  description: "Mission-critical SIEM-grade audit log explorer with AI reasoning replay.",
};

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 200,
    include: { user: true },
  });

  const stats = {
    total: logs.length,
    critical: logs.filter((l: any) => l.severity === "CRITICAL").length,
    warning: logs.filter((l: any) => l.severity === "WARNING").length,
    aiInvolved: logs.filter((l: any) => l.aiInvolved).length,
  };

  return (
    <Suspense fallback={<div className="p-8 text-zinc-400">Loading Audit Ledger...</div>}>
      <AuditExplorerClient logs={logs as any} stats={stats} />
    </Suspense>
  );
}
