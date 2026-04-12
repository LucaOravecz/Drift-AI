/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, BookOpen, Loader2, CheckCircle2, X, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { approveMemo, reviewInvestmentInsight, generateResearchMemo, runPortfolioScan } from "@/lib/actions";
import { toast } from "sonner";
import { parseFinding } from "@/lib/findings";
import { ExplainableFindingPanel } from "@/components/explainable-finding-panel";

const memoStatusColors: Record<string, string> = {
  DRAFT: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  REVIEWED: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  APPROVED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  ARCHIVED: "text-zinc-500 bg-zinc-800 border-zinc-700",
};

export function ResearchClient({ memos, insights, flags, clients }: { memos: any[]; insights: any[]; flags: any[]; clients: any[] }) {
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localMemos, setLocalMemos] = useState(memos);
  const [localInsights, setLocalInsights] = useState(insights);
  const [selectedClient, setSelectedClient] = useState(clients[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleApproveMemo = (id: string) => {
    setActiveId(id);
    startTransition(async () => {
      try {
        await approveMemo(id);
        toast.success("Memo approved", {
          description: "Institutional research has been finalized and staged for compliance review."
        });
        setLocalMemos((prev) => prev.map((m) => (m.id === id ? { ...m, status: "APPROVED" } : m)));
      } catch (err) {
        toast.error("Approval failed.");
      }
      setActiveId(null);
    });
  };

  const handleInsightAction = (id: string, action: "REVIEWED" | "SAVED_MEMO" | "DISMISSED") => {
    setActiveId(id);
    startTransition(async () => {
      try {
        await reviewInvestmentInsight(id, action);
        toast.success("Action logged", {
          description: `Portfolio flag updated to ${action.replace("_", " ")}.`
        });
        setLocalInsights((prev) => prev.map((i) => (i.id === id ? { ...i, status: action } : i)));
      } catch (err) {
        toast.error("Insight update failed.");
      }
      setActiveId(null);
    });
  };

  const handleGenerate = () => {
    if (!selectedClient || !topic) return;
    setGenerating(true);
    startTransition(async () => {
      try {
        await generateResearchMemo(selectedClient, topic);
        toast.success("Memo generated", {
          description: "AI-drafted research memo is now available in the vault."
        });
        window.location.reload();
      } catch (err) {
        toast.error("Generation failed.");
      }
      setGenerating(false);
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white/90">Investment Research Copilot</h1>
          <p className="text-zinc-400 mt-1">Holdings-based portfolio findings, research memos, and draft investment insights.</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 text-zinc-300"
            onClick={() => {
              startTransition(async () => {
                try {
                  const result = await runPortfolioScan();
                  toast.success("Portfolio scan complete", {
                    description: result.created
                      ? `${result.created} client portfolio(s) produced explainable findings from stored holdings.`
                      : "No holdings-based findings exceeded the configured thresholds."
                  });
                  window.location.reload();
                } catch (err) {
                  toast.error("Portfolio scan failed", {
                    description: err instanceof Error ? err.message : "Unable to complete the holdings scan."
                  });
                }
              });
            }}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
            Run Portfolio Scan
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 shadow-[0_0_15px_rgba(var(--primary),0.3)]"
            onClick={() => document.getElementById("generate-tab")?.click()}
          >
            <Sparkles className="mr-2 h-4 w-4" />Generate New Memo
          </Button>
        </div>
      </div>

      {/* Compliance Notice */}
      <div className="bg-blue-900/10 border border-blue-900/30 rounded-lg p-4 flex items-start gap-4">
        <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-blue-500">Research Assistance Only</h4>
          <p className="text-sm text-blue-500/80 mt-1">
            This module provides research assistance and draft insights for licensed professional review. It does not perform autonomous portfolio management or execute trades.
          </p>
        </div>
      </div>

      <Tabs defaultValue="insights" className="w-full">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="insights" className="data-[state=active]:bg-white/10">
            Portfolio Flags {insights.filter((i) => i.status === "UNDER_REVIEW").length > 0 && (
              <span className="ml-1.5 bg-amber-500/20 text-amber-400 text-[9px] px-1.5 py-0.5 rounded-full">{insights.filter((i) => i.status === "UNDER_REVIEW").length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="memos" className="data-[state=active]:bg-white/10">Research Memos</TabsTrigger>
          <TabsTrigger id="generate-tab" value="generate" className="data-[state=active]:bg-white/10">Generate Memo</TabsTrigger>
        </TabsList>

        {/* Portfolio Flags / Insights */}
        <TabsContent value="insights" className="mt-5">
          <div className="grid gap-5 md:grid-cols-2">
            <AnimatePresence>
              {localInsights.map((insight) => (
                (() => {
                  const finding = parseFinding(insight.dataSources);
                  return (
                <motion.div key={insight.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className={`bg-white/[0.02] border-white/5 flex flex-col ${insight.status === "DISMISSED" ? "opacity-40" : ""}`}>
                    <CardHeader className="pb-3 border-b border-white/5">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-500">
                          {insight.assetTicker ?? "Multi-Asset"}
                        </Badge>
                        <Badge className={`text-[10px] ${insight.status === "UNDER_REVIEW" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : insight.status === "SAVED_MEMO" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-800 text-zinc-500 border-zinc-700"}`}>
                          {insight.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <CardTitle className="text-sm text-white/90">{insight.title}</CardTitle>
                      <CardDescription className="text-xs">{insight.client?.name}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-1 gap-3 pt-4 text-xs">
                      <div>
                        <div className="text-zinc-500 font-medium mb-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Thesis</div>
                        <div className="text-zinc-300 leading-relaxed">{insight.thesis}</div>
                      </div>
                      <ExplainableFindingPanel finding={finding} fallbackEvidence={finding ? null : insight.dataSources} />
                      {insight.risks && (
                        <div>
                          <div className="text-zinc-500 font-medium mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" /> Risks</div>
                          <div className="text-zinc-400">{insight.risks}</div>
                        </div>
                      )}
                      {insight.catalysts && (
                        <div>
                          <div className="text-zinc-500 font-medium mb-1">Catalysts</div>
                          <div className="text-zinc-400">{insight.catalysts}</div>
                        </div>
                      )}
                      {insight.status === "UNDER_REVIEW" && (
                        <div className="flex gap-2 mt-auto pt-2">
                          <Button size="sm" className="flex-1 h-7 text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                            disabled={isPending && activeId === insight.id} onClick={() => handleInsightAction(insight.id, "SAVED_MEMO")}>
                            {isPending && activeId === insight.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><BookOpen className="mr-1 h-3 w-3" />Save as Memo</>}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[11px] border-white/10 text-zinc-400"
                            disabled={isPending && activeId === insight.id} onClick={() => handleInsightAction(insight.id, "REVIEWED")}>
                            Review
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-600"
                            disabled={isPending && activeId === insight.id} onClick={() => handleInsightAction(insight.id, "DISMISSED")}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
                  );
                })()
              ))}
              {insights.length === 0 && (
                <div className="col-span-2 text-center py-12 text-zinc-600">No portfolio insights on file.</div>
              )}
            </AnimatePresence>
          </div>
        </TabsContent>

        {/* Memos */}
        <TabsContent value="memos" className="mt-5">
          <div className="flex flex-col gap-4">
            {localMemos.map((memo) => (
              <Card key={memo.id} className="bg-white/[0.02] border-white/5">
                <CardHeader className="pb-3 border-b border-white/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-sm text-white/90">{memo.title}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {memo.client?.name ?? "General Research"} · {memo.assetOrSector} · {new Date(memo.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] ${memoStatusColors[memo.status] ?? ""}`}>{memo.status}</Badge>
                      <span className="text-[10px] text-zinc-600">{memo.generatedBy}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 grid gap-4 md:grid-cols-2 text-xs">
                  <div>
                    <div className="text-zinc-500 font-medium mb-1">Thesis</div>
                    <div className="text-zinc-300 leading-relaxed">{memo.thesis}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 font-medium mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-400" />Risks</div>
                    <div className="text-zinc-400">{memo.risks}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 font-medium mb-1">Catalysts</div>
                    <div className="text-zinc-400">{memo.catalysts}</div>
                  </div>
                  {memo.questions && (
                    <div>
                      <div className="text-zinc-500 font-medium mb-1">Open Questions</div>
                      <div className="text-zinc-400">{memo.questions}</div>
                    </div>
                  )}
                  {memo.status === "DRAFT" || memo.status === "REVIEWED" ? (
                    <div className="md:col-span-2 flex gap-2">
                      <Button size="sm" className="h-8 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                        disabled={isPending && activeId === memo.id} onClick={() => { setActiveId(memo.id); startTransition(async () => { await approveMemo(memo.id); setLocalMemos((p) => p.map((m) => m.id === memo.id ? { ...m, status: "APPROVED" } : m)); setActiveId(null); }); }}>
                        {isPending && activeId === memo.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="mr-1 h-3 w-3" />Approve Memo</>}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
            {localMemos.length === 0 && (
              <div className="text-center py-12 text-zinc-600">No research memos on file. Generate one from the Generate tab.</div>
            )}
          </div>
        </TabsContent>

        {/* Generate */}
        <TabsContent value="generate" className="mt-5">
          <Card className="bg-white/[0.02] border-white/5 max-w-lg">
            <CardHeader>
              <CardTitle className="text-base text-white/90">Generate Research Memo</CardTitle>
              <CardDescription>AI will draft a research memo for advisor review. Not final investment advice.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Client (optional)</label>
                <select
                  className="w-full bg-white/[0.03] border border-white/10 rounded-md px-3 py-2 text-sm text-zinc-300 focus:outline-none"
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                >
                  {clients.map((c) => <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Topic / Asset / Sector</label>
                <input
                  type="text"
                  placeholder="e.g., Private Credit, Municipal Bonds, Tech Rebalance"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-md px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
              <Button
                className="bg-primary hover:bg-primary/90 shadow-[0_0_15px_rgba(var(--primary),0.2)]"
                disabled={generating || isPending || !topic}
                onClick={handleGenerate}
              >
                {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating Draft...</> : <><Sparkles className="mr-2 h-4 w-4" />Generate Draft Memo</>}
              </Button>
              <p className="text-xs text-zinc-600">Generated memos are DRAFT status and require advisor review before any client communication.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
