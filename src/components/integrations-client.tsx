"use client";

import { useTransition, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Users, RefreshCw, Loader2, CheckCircle2, XCircle, AlertTriangle, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

interface IntegrationProvider {
  provider: string;
  category: string;
  status: string;
  lastSyncAt: string | null;
  errorCount: number;
  lastError?: string | null;
}

interface SyncResult {
  custodian?: string;
  provider?: string;
  accountsSynced?: number;
  positionsUpdated?: number;
  contactsImported?: number;
  contactsUpdated?: number;
  errors: string[] | number;
  syncTime: string;
}

const statusColors: Record<string, string> = {
  ACTIVE: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  PENDING: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  ERROR: "text-red-400 border-red-500/30 bg-red-500/10",
  DISCONNECTED: "text-zinc-500 border-zinc-600 bg-zinc-800/50",
};

const statusIcons: Record<string, any> = {
  ACTIVE: CheckCircle2,
  PENDING: AlertTriangle,
  ERROR: XCircle,
  DISCONNECTED: XCircle,
};

const categoryLabels: Record<string, string> = {
  CUSTODIAN: "Custodian",
  CRM: "CRM",
  PORTFOLIO_ACCOUNTING: "Portfolio Accounting",
  CALENDAR: "Calendar",
  EMAIL_DELIVERY: "Email",
  E_SIGNATURE: "E-Signature",
  MARKET_DATA: "Market Data",
};

export function IntegrationsClient({ providers }: { providers: IntegrationProvider[] }) {
  const [isPendingSync, startSyncTransition] = useTransition();
  const [isPendingCRM, startCRMTransition] = useTransition();

  const custodians = providers.filter((p) => p.category === "CUSTODIAN");
  const crms = providers.filter((p) => p.category === "CRM");
  const others = providers.filter((p) => p.category !== "CUSTODIAN" && p.category !== "CRM");

  const syncCustodians = () => {
    startSyncTransition(async () => {
      try {
        const res = await fetch("/api/v1/custodian/sync", { method: "POST" });
        if (!res.ok) throw new Error("Sync failed");
        const data = await res.json();
        const totalAccounts = data.data.reduce((s: number, r: any) => s + (r.accountsSynced ?? 0), 0);
        const totalPositions = data.data.reduce((s: number, r: any) => s + (r.positionsUpdated ?? 0), 0);
        toast.success("Custodian Sync Complete", { description: `${totalAccounts} accounts synced, ${totalPositions} positions updated` });
      } catch {
        toast.error("Sync Failed", { description: "Could not sync custodian positions." });
      }
    });
  };

  const importCRM = () => {
    startCRMTransition(async () => {
      try {
        const res = await fetch("/api/v1/crm/import", { method: "POST" });
        if (!res.ok) throw new Error("Import failed");
        const data = await res.json();
        const totalImported = data.data.reduce((s: number, r: any) => s + (r.contactsImported ?? 0), 0);
        const totalUpdated = data.data.reduce((s: number, r: any) => s + (r.contactsUpdated ?? 0), 0);
        toast.success("CRM Import Complete", { description: `${totalImported} new contacts, ${totalUpdated} updated` });
      } catch {
        toast.error("Import Failed", { description: "Could not import CRM contacts." });
      }
    });
  };

  const renderProvider = (p: IntegrationProvider) => {
    const Icon = statusIcons[p.status] ?? AlertTriangle;
    return (
      <div key={p.provider} className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
        <div className="flex items-center gap-3">
          <Icon className={`h-4 w-4 ${statusColors[p.status]?.split(" ")[0] ?? "text-zinc-400"}`} />
          <div>
            <div className="text-white text-sm font-medium">{p.provider.replace(/_/g, " ")}</div>
            <div className="text-zinc-500 text-xs">
              {p.lastSyncAt ? `Last sync: ${new Date(p.lastSyncAt).toLocaleString()}` : "Never synced"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={statusColors[p.status] ?? ""}>{p.status}</Badge>
          {p.errorCount > 0 && <span className="text-red-400 text-xs">{p.errorCount} errors</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6 text-cyan-400" />
          Integrations
        </h1>
        <p className="text-zinc-400 text-sm mt-1">Custodian, CRM, and third-party connector management</p>
      </div>

      {/* Custodian Integrations */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-400" />
                Custodian Integrations
              </CardTitle>
              <CardDescription className="text-zinc-400">Schwab, Fidelity, Pershing — position sync and trade execution</CardDescription>
            </div>
            <Button onClick={syncCustodians} disabled={isPendingSync} size="sm" className="bg-blue-600 hover:bg-blue-700">
              {isPendingSync ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Sync All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {custodians.length > 0 ? custodians.map(renderProvider) : (
            <p className="text-zinc-500 text-center py-4">No custodian integrations configured. Add credentials in Settings.</p>
          )}
        </CardContent>
      </Card>

      {/* CRM Integrations */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-400" />
                CRM Integrations
              </CardTitle>
              <CardDescription className="text-zinc-400">Redtail, Salesforce FSC — contact import and bidirectional sync</CardDescription>
            </div>
            <Button onClick={importCRM} disabled={isPendingCRM} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              {isPendingCRM ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Import Contacts
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {crms.length > 0 ? crms.map(renderProvider) : (
            <p className="text-zinc-500 text-center py-4">No CRM integrations configured. Add credentials in Settings.</p>
          )}
        </CardContent>
      </Card>

      {/* Other Integrations */}
      {others.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Other Integrations</CardTitle>
          </CardHeader>
          <CardContent>
            {others.map((p) => (
              <div key={p.provider} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-300 text-sm">{p.provider.replace(/_/g, " ")}</span>
                  <Badge variant="outline" className="text-zinc-500 text-xs">{categoryLabels[p.category] ?? p.category}</Badge>
                </div>
                <Badge variant="outline" className={statusColors[p.status] ?? ""}>{p.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
