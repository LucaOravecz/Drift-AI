"use client";

import { useTransition, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Loader2, RefreshCw, CreditCard, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";

interface FeeCalculation {
  clientId: string;
  clientName?: string;
  aum: number;
  feeAmount: number;
  effectiveRate: number;
  scheduleType: string;
  tiers?: Array<{ min: number; max: number | null; rate: number; fee: number }>;
}

interface BatchResult {
  totalClients: number;
  totalFees: number;
  totalAUM: number;
  calculations: FeeCalculation[];
}

export function BillingClient({ clients }: { clients: Array<{ id: string; name: string; aum: number | null }> }) {
  const [isPendingCalc, startCalcTransition] = useTransition();
  const [isPendingBatch, startBatchTransition] = useTransition();
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);

  const runBatch = () => {
    startBatchTransition(async () => {
      try {
        const res = await fetch("/api/v1/billing/batch", { method: "POST" });
        if (!res.ok) throw new Error("Batch billing failed");
        const data = await res.json();
        setBatchResult(data.data);
        toast.success("Batch Billing Complete", {
          description: `${data.data.totalClients} clients, $${data.data.totalFees?.toLocaleString() ?? 0} total fees`,
        });
      } catch {
        toast.error("Batch Billing Failed", { description: "Could not run batch billing." });
      }
    });
  };

  const totalAUM = clients.reduce((s, c) => s + (c.aum ?? 0), 0);
  const avgAUM = clients.length > 0 ? totalAUM / clients.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-green-400" />
            Billing & Fee Management
          </h1>
          <p className="text-zinc-400 text-sm mt-1">AUM-based tiered fee schedules and billing cycles</p>
        </div>
        <Button onClick={runBatch} disabled={isPendingBatch} className="bg-green-600 hover:bg-green-700">
          {isPendingBatch ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Run Batch Billing
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400">Total AUM</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${(totalAUM / 1_000_000).toFixed(1)}M</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400">Clients</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{clients.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400">Avg AUM / Client</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${(avgAUM / 1_000_000).toFixed(2)}M</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400">Default Fee Schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-zinc-300">
              <div>$0-1M: <span className="text-white">1.00%</span></div>
              <div>$1-5M: <span className="text-white">0.80%</span></div>
              <div>$5-10M: <span className="text-white">0.60%</span></div>
              <div>$10-25M: <span className="text-white">0.45%</span></div>
              <div>$25M+: <span className="text-white">0.35%</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Fee List */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-lg">Client AUM</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {clients.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <span className="text-zinc-300">{c.name}</span>
                <span className="text-white font-medium">${(c.aum ?? 0).toLocaleString()}</span>
              </div>
            ))}
            {clients.length === 0 && (
              <p className="text-zinc-500 text-center py-4">No clients found.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Batch Results */}
      {batchResult && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-400" />
              Batch Billing Results
            </CardTitle>
            <CardDescription className="text-zinc-400">
              {batchResult.totalClients} clients | Total AUM: ${(batchResult.totalAUM / 1_000_000).toFixed(1)}M | Total Fees: ${batchResult.totalFees?.toLocaleString() ?? 0}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {batchResult.calculations?.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-300 text-sm">{c.clientName ?? c.clientId}</span>
                    <Badge variant="outline" className="text-zinc-500 text-xs">{c.scheduleType}</Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-zinc-400 text-sm">AUM: ${c.aum.toLocaleString()}</span>
                    <span className="text-green-400 font-medium">${c.feeAmount.toLocaleString()}</span>
                    <span className="text-zinc-500 text-xs">({(c.effectiveRate * 100).toFixed(2)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
