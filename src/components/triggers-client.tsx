"use client";

import { useTransition, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Clock, AlertTriangle, CheckCircle2, Loader2, RefreshCw, Users, FileWarning, TrendingUp, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface TriggerResult {
  ruleId: string;
  category: string;
  clientId: string;
  clientName: string;
  action: string;
  createdId: string;
  title: string;
  description: string;
  priority: string;
  advisorNotified: boolean;
}

interface TriggerRunResult {
  runId: string;
  rulesEvaluated: number;
  triggersFired: number;
  actionsCreated: number;
  results: TriggerResult[];
  runDate: string;
  durationMs: number;
}

const categoryIcons: Record<string, any> = {
  AGE_MILESTONE: Calendar,
  PORTFOLIO_DRIFT: TrendingUp,
  ENGAGEMENT_GAP: Users,
  DOCUMENT_STALE: FileWarning,
  LIFE_EVENT_FOLLOWUP: AlertTriangle,
  TAX_DEADLINE: Clock,
  CHURN_RISK: AlertTriangle,
  CASH_DRIFT: TrendingUp,
  ONBOARDING_STALLED: Clock,
};

const priorityColors: Record<string, string> = {
  URGENT: "text-red-400 border-red-500/30 bg-red-500/10",
  HIGH: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  MEDIUM: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  LOW: "text-zinc-400 border-zinc-500/30 bg-zinc-500/10",
};

const actionColors: Record<string, string> = {
  CREATE_TASK: "text-blue-400",
  CREATE_OPPORTUNITY: "text-emerald-400",
  CREATE_FLAG: "text-amber-400",
  NOTIFY_ONLY: "text-zinc-400",
};

export function TriggersClient({ summary }: { summary: { lastRunDate: string | null; totalTriggersFired: number; byCategory: Record<string, number>; recentResults: TriggerResult[] } }) {
  const [isPending, startTransition] = useTransition();
  const [runResult, setRunResult] = useState<TriggerRunResult | null>(null);

  const runTriggers = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/triggers/run", { method: "POST" });
        if (!res.ok) throw new Error("Trigger run failed");
        const data = await res.json();
        setRunResult(data.data);
        toast.success("Triggers Evaluated", {
          description: `${data.data.triggersFired} triggers fired across ${data.data.rulesEvaluated} rules`,
        });
      } catch {
        toast.error("Trigger Run Failed", { description: "Could not evaluate triggers." });
      }
    });
  };

  const categoryEntries = Object.entries(summary.byCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="h-6 w-6 text-blue-400" />
            Proactive Workflow Triggers
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Automated event-based actions across your client base</p>
        </div>
        <Button onClick={runTriggers} disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Run Triggers
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400">Last Run</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-white">
              {summary.lastRunDate ? new Date(summary.lastRunDate).toLocaleString() : "Never"}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400">Triggers Fired (Last Run)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{summary.totalTriggersFired}</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400">Categories Active</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{categoryEntries.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {categoryEntries.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Trigger Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {categoryEntries.map(([cat, count]) => {
                const Icon = categoryIcons[cat] ?? Zap;
                return (
                  <div key={cat} className="p-3 rounded-lg border border-zinc-800 bg-zinc-850 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-zinc-400" />
                    <div>
                      <div className="text-xs text-zinc-500">{cat.replace(/_/g, " ")}</div>
                      <div className="text-white font-medium">{count}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Trigger Results */}
      {summary.recentResults.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Recent Triggers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.recentResults.slice(0, 10).map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={priorityColors[r.priority] ?? priorityColors.MEDIUM}>{r.priority}</Badge>
                    <span className="text-zinc-300 text-sm">{r.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-zinc-500">{r.category}</Badge>
                    <span className={`text-xs ${actionColors[r.action] ?? "text-zinc-400"}`}>{r.action.replace("CREATE_", "")}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Run Results */}
      <AnimatePresence>
        {runResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-400" />
                  Trigger Run — {new Date(runResult.runDate).toLocaleString()}
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  {runResult.rulesEvaluated} rules evaluated | {runResult.triggersFired} fired | {runResult.durationMs}ms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {runResult.results.map((r, i) => (
                    <div key={i} className="p-4 rounded-lg border border-zinc-800 bg-zinc-850">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{r.clientName}</span>
                            <Badge variant="outline" className={priorityColors[r.priority]}>{r.priority}</Badge>
                          </div>
                          <p className="text-zinc-400 text-sm mt-1">{r.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-zinc-500">{r.category.replace(/_/g, " ")}</Badge>
                          <span className={`text-xs ${actionColors[r.action]}`}>{r.action.replace("CREATE_", "")}</span>
                          {r.advisorNotified && <span className="text-emerald-400 text-xs">Notified</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {runResult.results.length === 0 && (
                    <p className="text-zinc-500 text-center py-8">No triggers fired — all clients are within normal parameters.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
