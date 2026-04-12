"use client";

import { useTransition, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingDown, DollarSign, AlertTriangle, CheckCircle2, Loader2, RefreshCw, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface HarvestableLot {
  holdingId: string;
  clientId: string;
  clientName: string;
  ticker: string;
  securityName: string;
  quantity: number;
  unrealizedLoss: number;
  lossPercent: number;
  term: "SHORT_TERM" | "LONG_TERM";
  taxBenefitEstimate: number;
  washSaleRisk: boolean;
  isHarvestable: boolean;
  assetClass: string;
  accountType: string;
}

interface HarvestSuggestion {
  lot: HarvestableLot;
  suggestedAction: string;
  replacementTicker?: string;
  estimatedTaxSavings: number;
  washSaleSafe: boolean;
  complianceNote: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

interface SweepResult {
  id: string;
  totalLotsScanned: number;
  harvestableLotsFound: number;
  totalUnrealizedLosses: number;
  estimatedTaxSavings: number;
  suggestions: HarvestSuggestion[];
  excludedByWashSale: number;
  excludedByMinThreshold: number;
  excludedByAccountType: number;
  sweepDate: string;
}

interface HarvestSummary {
  totalHarvestable: number;
  totalUnrealizedLosses: number;
  estimatedTaxSavings: number;
  byClient: Array<{ clientId: string; clientName: string; harvestableCount: number; totalLoss: number }>;
}

const priorityColors: Record<string, string> = {
  HIGH: "text-red-400 border-red-500/30 bg-red-500/10",
  MEDIUM: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  LOW: "text-zinc-400 border-zinc-500/30 bg-zinc-500/10",
};

const termColors: Record<string, string> = {
  SHORT_TERM: "text-orange-400",
  LONG_TERM: "text-emerald-400",
};

export function TLHClient({ summary }: { summary: HarvestSummary }) {
  const [isPending, startTransition] = useTransition();
  const [sweepResult, setSweepResult] = useState<SweepResult | null>(null);

  const runSweep = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/tlh/sweep", { method: "POST" });
        if (!res.ok) throw new Error("Sweep failed");
        const data = await res.json();
        setSweepResult(data.data);
        toast.success("TLH Sweep Complete", {
          description: `${data.data.harvestableLotsFound} harvestable positions found, $${data.data.estimatedTaxSavings.toLocaleString()} estimated tax savings`,
        });
      } catch {
        toast.error("Sweep Failed", { description: "Could not run TLH sweep. Check integration status." });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-emerald-400" />
            Tax-Loss Harvesting
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Automated daily sweep engine for unrealized loss detection</p>
        </div>
        <Button onClick={runSweep} disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700">
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Run Sweep
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400">Harvestable Positions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{summary.totalHarvestable}</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400">Total Unrealized Losses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">${summary.totalUnrealizedLosses.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400 flex items-center gap-1"><DollarSign className="h-3 w-3" /> Est. Tax Savings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">${summary.estimatedTaxSavings.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400">Clients Affected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{summary.byClient.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Client Breakdown */}
      {summary.byClient.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">By Client</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.byClient.map((c) => (
                <div key={c.clientId} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <span className="text-zinc-300">{c.clientName}</span>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-zinc-400">{c.harvestableCount} positions</Badge>
                    <span className="text-red-400 font-medium">${c.totalLoss.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sweep Results */}
      <AnimatePresence>
        {sweepResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  Sweep Results — {new Date(sweepResult.sweepDate).toLocaleDateString()}
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  {sweepResult.totalLotsScanned} lots scanned | {sweepResult.excludedByWashSale} excluded (wash sale) | {sweepResult.excludedByAccountType} excluded (tax-deferred)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sweepResult.suggestions.map((s, i) => (
                    <div key={i} className="p-4 rounded-lg border border-zinc-800 bg-zinc-850">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{s.lot.ticker}</span>
                            <span className="text-zinc-500 text-sm">{s.lot.securityName}</span>
                            <Badge variant="outline" className={priorityColors[s.priority]}>{s.priority}</Badge>
                            <span className={`text-xs ${termColors[s.lot.term]}`}>{s.lot.term.replace("_", " ")}</span>
                          </div>
                          <div className="text-zinc-400 text-sm mt-1">
                            {s.lot.clientName} — {s.lot.quantity} shares — ${s.lot.unrealizedLoss.toLocaleString()} loss ({s.lot.lossPercent}%)
                          </div>
                          <div className="text-emerald-400 text-sm mt-1">
                            Est. tax savings: ${s.estimatedTaxSavings.toLocaleString()}
                            {s.replacementTicker && (
                              <span className="text-zinc-400"> → Replace with <span className="text-blue-400">{s.replacementTicker}</span></span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {s.washSaleSafe ? (
                            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10">Wash Sale Clear</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10"><AlertTriangle className="h-3 w-3 mr-1" />Wash Sale Risk</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-zinc-500 text-xs mt-2">{s.complianceNote}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
