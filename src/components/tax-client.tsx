"use client";

import { useTransition, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Landmark, AlertTriangle, CheckCircle2, X, RotateCcw, Loader2, ListTodo } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { reviewTaxInsight, runTaxScan } from "@/lib/actions";
import { toast } from "sonner";
import { parseFinding } from "@/lib/findings";
import { ExplainableFindingPanel } from "@/components/explainable-finding-panel";

const urgencyColors: Record<string, string> = {
  HIGH: "text-red-400 border-red-500/30 bg-red-500/10",
  MEDIUM: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  LOW: "text-zinc-400 border-zinc-500/30 bg-zinc-500/10",
};

const statusColors: Record<string, string> = {
  UNDER_REVIEW: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  ACCEPTED: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  DISMISSED: "text-zinc-500 border-zinc-700 bg-zinc-800/50",
  TASK_CREATED: "text-blue-400 border-blue-500/30 bg-blue-500/10",
};

export interface TaxInsight {
  id: string;
  clientId: string;
  title: string;
  category: string | null;
  urgency: "HIGH" | "MEDIUM" | "LOW";
  status: "UNDER_REVIEW" | "ACCEPTED" | "DISMISSED" | "TASK_CREATED";
  rationale: string;
  suggestedAction: string;
  estimatedImpact: string | null;
  evidence: string | null;
  explanation: string | null;
  confidence: number | null;
  client?: { name: string };
}

export function TaxClient({ insights, stats }: { insights: TaxInsight[]; stats: { total: number; underReview: number; highUrgency: number; accepted: number } }) {
  const [isPending, startTransition] = useTransition();
  const [localInsights, setLocalInsights] = useState(insights);
  const [activeId, setActiveId] = useState<string | null>(null);

  const handle = (id: string, action: "ACCEPTED" | "DISMISSED" | "TASK_CREATED") => {
    setActiveId(id);
    startTransition(async () => {
      try {
        const res = await reviewTaxInsight(id, action);
        if (res && !res.success) {
          toast.error("Review denied", { description: res.error });
          setActiveId(null);
          return;
        }
        toast.success("Review logged", {
          description: `Insight state updated to ${action.replace("_", " ")}.`
        });
        setLocalInsights((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: action } : i))
        );
      } catch {
        toast.error("Compliance error.");
      }
      setActiveId(null);
    });
  };

  const handleScan = () => {
    startTransition(async () => {
      const toastId = toast.loading("Executing institutional tax scan...");
      try {
        await runTaxScan();
        toast.success("Scan complete", {
          id: toastId,
          description: "Portfolio discrepancies and opportunities identified."
        });
        window.location.reload();
      } catch {
        toast.error("Scan failed", { id: toastId });
      }
    });
  };

  const active = localInsights.filter((i) => i.status === "UNDER_REVIEW");
  const reviewed = localInsights.filter((i) => i.status !== "UNDER_REVIEW");

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white/90">Tax Intelligence</h1>
          <p className="text-zinc-400 mt-1">Draft tax opportunities for advisor and CPA review.</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleScan}
            disabled={isPending}
            className="border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300"
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            Re-run Tax Scan
          </Button>
        </div>
      </div>

      {/* Compliance Notice */}
      <div className="bg-amber-900/10 border border-amber-900/30 rounded-lg p-4 flex items-start gap-4">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-amber-500">Compliance Notice</h4>
          <p className="text-sm text-amber-500/80 mt-1">
            These are draft opportunities for advisor and CPA review only. They do not constitute final tax, legal, or regulatory advice.
            Every recommendation must be reviewed by a licensed professional before client communication.
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Insights", value: stats.total, color: "text-white" },
          { label: "Pending Review", value: stats.underReview, color: "text-amber-400" },
          { label: "High Urgency", value: stats.highUrgency, color: "text-red-400" },
          { label: "Accepted", value: stats.accepted, color: "text-emerald-400" },
        ].map((s) => (
          <Card key={s.label} className="bg-white/[0.02] border-white/5">
            <CardContent className="pt-4 pb-3">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Insights */}
      {active.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
            Awaiting Review ({active.length})
          </h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {active.map((insight) => (
                (() => {
                  const finding = parseFinding(insight.explanation);
                  return (
                <motion.div
                  key={insight.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card className="bg-white/[0.02] border-white/5 flex flex-col h-full hover:border-white/10 transition-colors">
                    <CardHeader className="pb-3 border-b border-white/5">
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <Badge className={`text-[10px] font-semibold shrink-0 ${urgencyColors[insight.urgency] ?? urgencyColors.MEDIUM}`}>
                          {insight.urgency} URGENCY
                        </Badge>
                        <Badge variant="outline" className="text-[10px] text-zinc-500 border-zinc-700 shrink-0">
                          {insight.category ?? "TAX"}
                        </Badge>
                      </div>
                      <CardTitle className="text-base text-white/90 leading-snug">{insight.title}</CardTitle>
                      <CardDescription className="text-zinc-500 text-xs mt-1">{insight.client?.name}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-1 gap-3 pt-4">
                      <p className="text-sm text-zinc-300 leading-relaxed">{insight.rationale}</p>

                      {/* Confidence — now honest about what it means */}
                      {insight.confidence !== null && insight.confidence !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-600">Data confidence:</span>
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${insight.confidence >= 75 ? "bg-emerald-500/60" : insight.confidence >= 50 ? "bg-amber-500/60" : "bg-red-500/60"}`}
                              style={{ width: `${insight.confidence}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-mono ${insight.confidence >= 75 ? "text-emerald-400" : insight.confidence >= 50 ? "text-amber-400" : "text-red-400"}`}>
                            {insight.confidence}%
                          </span>
                        </div>
                      )}

                      {/* Estimated impact — only show if it's not the fallback disclaimer */}
                      {insight.estimatedImpact && !insight.estimatedImpact.startsWith("Tax insights are draft") && (
                        <div className="bg-primary/5 border border-primary/10 rounded-lg p-2.5">
                          <div className="text-xs text-zinc-500 mb-0.5">Estimated Impact</div>
                          <div className="text-sm font-semibold text-primary/90">{insight.estimatedImpact}</div>
                        </div>
                      )}

                      {/* Evidence — what triggered this */}
                      {insight.evidence && (
                        <div className="text-xs text-zinc-500 border-l-2 border-white/10 pl-3 space-y-0.5">
                          <div className="text-[10px] font-mono text-zinc-600 mb-1">DATA SOURCE</div>
                          {insight.evidence.split('\n').map((line, i) => (
                            <div key={i} className="text-zinc-500">{line}</div>
                          ))}
                        </div>
                      )}

                      {finding ? (
                        <ExplainableFindingPanel finding={finding} />
                      ) : insight.explanation ? (
                        <div className="text-[10px] text-amber-500/70 italic border-l-2 border-amber-500/20 pl-3">
                          {insight.explanation.split('\n')[0]}
                        </div>
                      ) : null}
                      <div className="mt-auto pt-3 border-t border-white/5">
                        <div className="text-xs text-zinc-500 mb-2 font-medium">Suggested Action</div>
                        <div className="text-xs text-zinc-300">{insight.suggestedAction}</div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                          disabled={isPending && activeId === insight.id}
                          onClick={() => handle(insight.id, "ACCEPTED")}
                        >
                          {isPending && activeId === insight.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-white/10 hover:bg-white/5 text-zinc-400"
                          disabled={isPending && activeId === insight.id}
                          onClick={() => handle(insight.id, "TASK_CREATED")}
                        >
                          <ListTodo className="mr-1 h-3 w-3" />
                          Create Task
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-zinc-600 hover:text-zinc-400 hover:bg-white/5"
                          disabled={isPending && activeId === insight.id}
                          onClick={() => handle(insight.id, "DISMISSED")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
                  );
                })()
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Reviewed Insights */}
      {reviewed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-600 uppercase tracking-widest mb-4">
            Reviewed ({reviewed.length})
          </h2>
          <div className="grid gap-3">
            {reviewed.map((insight) => (
              <Card key={insight.id} className="bg-white/[0.01] border-white/5 opacity-60">
                <CardContent className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Landmark className="h-4 w-4 text-zinc-600 shrink-0" />
                    <div>
                      <div className="text-sm text-zinc-400">{insight.title}</div>
                      <div className="text-xs text-zinc-600">{insight.client?.name}</div>
                    </div>
                  </div>
                  <Badge className={`text-[10px] shrink-0 ${statusColors[insight.status] ?? ""}`}>
                    {insight.status.replace("_", " ")}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {localInsights.length === 0 && (
        <Card className="bg-white/[0.01] border-white/5 border-dashed">
          <CardContent className="py-16 text-center">
            <Landmark className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
            <div className="text-zinc-500">No tax insights on file. Run a scan to detect opportunities.</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
