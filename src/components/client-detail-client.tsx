/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import type { ClientService } from "@/lib/services/client.service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Brain, FileText, Shield, MessageSquare,
  Calendar, AlertTriangle, CheckCircle2, Clock, Star, User, Phone, Mail,
  Check, X, Zap, Loader2,
} from "lucide-react";
import { 
  dismissOpportunity, 
  approveOpportunity, 
  reviewTaxInsight,
  updateClient,
  markClientReviewed,
  createTask,
  refreshClientMemory,
} from "@/lib/actions";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { HouseholdTopology } from "./household-topology";
import { AuditTimeline } from "./audit-timeline";
import { motion, AnimatePresence } from "framer-motion";
import { parseFinding } from "@/lib/findings";
import { ExplainableFindingPanel } from "@/components/explainable-finding-panel";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (!n) return "$0";
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}k`;
}

const riskColors: Record<string, string> = {
  CONSERVATIVE: "text-emerald-400",
  MODERATE: "text-amber-400",
  AGGRESSIVE: "text-red-400",
  MODERATE_AGGRESSIVE: "text-orange-400",
};

const urgencyColors: Record<string, string> = {
  HIGH: "text-red-400 bg-red-500/10 border-red-500/20",
  MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  LOW: "text-zinc-400 border-zinc-700",
};

const statusColors: Record<string, string> = {
  DRAFT: "text-primary bg-primary/10 border-primary/20",
  PENDING_REVIEW: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  REJECTED: "text-zinc-500 bg-zinc-800 border-zinc-700",
  EXECUTED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  UNDER_REVIEW: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  ACCEPTED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  DISMISSED: "text-zinc-500 bg-zinc-800 border-zinc-700",
};

// ── component ─────────────────────────────────────────────────────────────────

interface Opportunity {
  id: string;
  clientId: string;
  type: string;
  valueEst: number | null;
  confidence: number;
  description: string;
  evidence: string | null;
  reasoning: string | null;
  suggestedAction: string;
  status: "DRAFT" | "PENDING_REVIEW" | "REJECTED" | "EXECUTED";
  createdAt: Date;
  updatedAt: Date;
}

interface TaxInsight {
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
}

type ClientDetail = NonNullable<Awaited<ReturnType<typeof ClientService.getClientDetail>>>

export function ClientDetailClient({ 
  client, 
  topology, 
  auditLogs 
}: { 
  client: any; 
  topology: any; 
  auditLogs: any;
}) {
  // Scenario Modeler
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [scenarioType, setScenarioType] = useState("BUSINESS_SALE");
  const [scenarioMagnitude, setScenarioMagnitude] = useState("10000000");
  const [scenarioTimeline, setScenarioTimeline] = useState("6");
  const [scenarioResult, setScenarioResult] = useState<any>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const intel = client.intelligence;
  const memoryPayload = client.memorySnapshot?.payload;
  const openOpps = client.opportunities.filter((o: Opportunity) => o.status === "DRAFT").length;
  const pendingTax = client.taxInsights.filter((t: TaxInsight) => t.status === "UNDER_REVIEW").length;


  const handleRunScenario = async () => {
    setScenarioLoading(true);
    setScenarioResult(null);
    try {
      const res = await fetch("/api/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, scenarioType, magnitude: parseFloat(scenarioMagnitude), timelineMonths: parseInt(scenarioTimeline) }),
      });
      if (!res.ok) throw new Error("failed");
      setScenarioResult(await res.json());
    } catch {
      toast.error("Scenario model failed.");
    } finally {
      setScenarioLoading(false);
    }
  };

  const handleMarkReviewed = () => {
    startTransition(async () => {
      try {
        await markClientReviewed(client.id);
        toast.success("Review finalized", { description: "Institutional audit log updated. Performance report staged for client portal." });
      } catch (err) { toast.error("Review failed."); }
    });
  };

  const handleCreateTask = () => {
    startTransition(async () => {
      try {
        await createTask(client.id, "Follow-up on portfolio rebalance", "MEDIUM");
        toast.success("Success", { description: "Institutional task created and assigned to compliance desk." });
      } catch (err) { toast.error("Task creation failed."); }
    });
  };

  const handleRefreshMemory = () => {
    startTransition(async () => {
      try {
        const result = await refreshClientMemory(client.id);
        toast.success("Client memory refreshed", {
          description: `Stored snapshot updated with ${result.dataQuality.toLowerCase()} data quality.`
        });
        window.location.reload();
      } catch {
        toast.error("Client memory refresh failed.");
      }
    });
  };

  return (
    <>
      {/* Scenario Modeler Modal */}
      <AnimatePresence>
        {scenarioOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setScenarioOpen(false); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-violet-500/20 bg-zinc-950 shadow-2xl">
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20"><Zap className="h-4 w-4 text-violet-400" /></div>
                  <div><h2 className="text-sm font-bold text-zinc-100">What-If Scenario Modeler</h2>
                  <p className="text-xs text-zinc-500">Asymmetric strategic analysis for {client.name}</p></div>
                </div>
                <button onClick={() => setScenarioOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X className="h-4 w-4" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-2 block">Scenario Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[["BUSINESS_SALE","Business Sale"],["LIQUIDITY_EVENT","Liquidity Event"],["INHERITANCE","Inheritance"],["MARKET_DRAWDOWN","Market Drawdown"],["INTEREST_RATE_SHIFT","Rate Shift"]].map(([v,l]) => (
                      <button key={v} onClick={() => setScenarioType(v)}
                        className={`p-2.5 rounded-lg border text-xs font-medium text-left transition-all ${scenarioType === v ? "border-violet-500/40 bg-violet-500/10 text-violet-300" : "border-white/5 bg-white/[0.02] text-zinc-500 hover:border-zinc-700"}`}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-2 block">{scenarioType === "MARKET_DRAWDOWN" || scenarioType === "INTEREST_RATE_SHIFT" ? "Magnitude (% or bps)" : "Event Value ($)"}</label>
                  <input type="number" value={scenarioMagnitude} onChange={e => setScenarioMagnitude(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-2 block">Advisory Timeline</label>
                  <div className="flex gap-2">{["3","6","12","24"].map(m => (
                    <button key={m} onClick={() => setScenarioTimeline(m)}
                      className={`px-4 py-2 rounded-lg border text-xs font-medium transition-all ${scenarioTimeline === m ? "border-violet-500/40 bg-violet-500/10 text-violet-300" : "border-white/5 bg-white/[0.02] text-zinc-500 hover:border-zinc-700"}`}>{m}mo</button>
                  ))}</div>
                </div>
                <button onClick={handleRunScenario} disabled={scenarioLoading}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                  {scenarioLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Running Analysis...</> : <><Zap className="h-4 w-4" /> Run Scenario Model</>}
                </button>
                {scenarioResult && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 border-t border-white/5 pt-4">
                    <p className="text-sm font-bold text-violet-300">{scenarioResult.scenarioTitle}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Projected AUM</p>
                        <p className="text-lg font-bold text-zinc-100">{scenarioResult.projectedState?.projectedAum}</p>
                        <p className="text-xs text-emerald-400">{scenarioResult.projectedState?.deltaFromBaseline}</p>
                      </div>
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Est. Tax Event</p>
                        <p className="text-base font-bold text-amber-400">{scenarioResult.projectedState?.newTaxLiability}</p>
                      </div>
                    </div>
                    {scenarioResult.highConvictionPlays?.map((play: any, i: number) => (
                      <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold text-violet-400">#{play.priority}</span><p className="text-xs font-semibold text-zinc-100">{play.title}</p></div>
                        <p className="text-xs text-zinc-400">{play.rationale}</p>
                        <div className="flex items-center justify-between mt-2"><span className="text-[10px] text-emerald-400">{play.estimatedImpact}</span><span className="text-[10px] text-zinc-500">{play.timeToExecute}</span></div>
                      </div>
                    ))}
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                      <p className="text-[10px] text-red-400 uppercase tracking-wide font-semibold mb-1">Risk of Inaction</p>
                      <p className="text-xs text-zinc-300">{scenarioResult.riskOfInaction}</p>
                    </div>
                    <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                      <p className="text-[10px] text-violet-400 uppercase tracking-wide font-semibold mb-1">Immediate Next Step</p>
                      <p className="text-xs text-zinc-300">{scenarioResult.immediateNextStep}</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    <div className="flex flex-col gap-6 pb-12">
      {/* Back + header */}
      <div>
        <Link href="/clients" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> All Clients
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold tracking-tight text-white/90">{client.name}</h1>
              <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">{client.type}</Badge>
              {client.tags && client.tags.split(",").map((tag: string) => (
                <span key={tag} className="text-[9px] bg-zinc-800/50 text-zinc-400 px-1.5 py-0.5 rounded border border-white/5">{tag.trim()}</span>
              ))}
            </div>
            <div className="flex items-center gap-4 text-sm text-zinc-500">
              {client.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{client.email}</span>}
              {client.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="sm" className="h-8 text-[11px] border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
              onClick={() => { setScenarioOpen(true); setScenarioResult(null); }}>
              <Zap className="h-3 w-3 mr-1" /> What-If Modeler
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[11px] border-white/10 hover:bg-white/5"
              onClick={handleCreateTask}
              disabled={isPending}
            >
              <FileText className="h-3 w-3 mr-1" /> Create Task
            </Button>
            <Button
              size="sm"
              className="h-8 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleMarkReviewed}
              disabled={isPending}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" /> Finish Review
            </Button>
            <div className="ml-4 text-right">
              <div className="text-3xl font-bold text-primary">{fmt(client.aum)}</div>
              <div className="text-xs text-zinc-500 mt-0.5">Assets Under Management</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Risk Profile", value: client.riskProfile ?? "Unknown", color: riskColors[client.riskProfile ?? ""] ?? "text-zinc-300" },
          { label: "Churn Risk", value: `${client.churnScore}%`, color: client.churnScore > 60 ? "text-red-400" : client.churnScore > 30 ? "text-amber-400" : "text-emerald-400" },
          { label: "Open Opps", value: openOpps, color: openOpps > 0 ? "text-primary" : "text-zinc-500" },
          { label: "Tax Items", value: pendingTax, color: pendingTax > 0 ? "text-amber-400" : "text-zinc-500" },
          { label: "Sentiment", value: `${intel?.sentimentScore ?? "—"}/100`, color: "text-zinc-300" },
        ].map((s) => (
          <Card key={s.label} className="bg-white/[0.02] border-white/5">
            <CardContent className="pt-3 pb-2">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Intelligence profile sidebar */}
        <div className="flex flex-col gap-4">
          {topology?.members?.length > 0 && (
            <HouseholdTopology 
              householdId={topology.householdId} 
              members={topology.members} 
            />
          )}

          <Card className="bg-white/[0.02] border-white/5">
            <CardHeader className="pb-2 border-b border-white/5">
              <CardTitle className="text-sm flex items-center gap-2 text-zinc-300">
                <Brain className="h-4 w-4 text-primary" /> Client Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-sm">
              {memoryPayload ? (
                <>
                  <div className="mb-4 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] text-primary/70 uppercase tracking-wider mb-1 font-semibold">Client Memory Snapshot</div>
                        <p className="text-xs text-zinc-300 leading-relaxed">{client.memorySnapshot.summary}</p>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 border-white/10 bg-white/5 text-[11px]" onClick={handleRefreshMemory} disabled={isPending}>
                        Refresh
                      </Button>
                    </div>
                    {client.memorySnapshot.missingData?.length > 0 && (
                      <div className="mt-3 text-[10px] text-amber-400">
                        Missing data: {client.memorySnapshot.missingData.join(", ")}
                      </div>
                    )}
                  </div>
                  <Field label="Life Stage" value={memoryPayload.knownFacts.lifeStage.value} />
                  <Field label="Goals" value={memoryPayload.knownFacts.goals.value} />
                  <Field label="Concerns" value={memoryPayload.knownFacts.concerns.value} />
                  <Field label="Family Context" value={memoryPayload.knownFacts.familyContext.value} />
                  <Field label="Communication Style" value={memoryPayload.knownFacts.communicationPreferences.value} />
                  {intel?.riskNotes && <Field label="Risk Notes" value={intel.riskNotes} />}
                  <div>
                    <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Relationship Strength</div>
                    <Progress value={memoryPayload.intelligence?.relationStrength ?? intel?.relationStrength ?? 0} className="h-1.5" />
                    <div className="text-xs text-zinc-500 mt-1">{memoryPayload.intelligence?.relationStrength ?? intel?.relationStrength ?? "—"}/100</div>
                  </div>
                </>
              ) : (
                <p className="text-zinc-600 text-xs">Insufficient data: no client memory snapshot is stored yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Recent life events */}
          {client.events.length > 0 && (
            <Card className="bg-white/[0.02] border-white/5">
              <CardHeader className="pb-2 border-b border-white/5">
                <CardTitle className="text-sm text-zinc-300">Life Events</CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-2">
                {client.events.map((e: any) => (
                  <div key={e.id} className="text-xs">
                    <div className="text-zinc-300 font-medium">{e.title}</div>
                    {e.implications && <div className="text-zinc-600 mt-0.5">{e.implications}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Open tasks */}
          {client.tasks.length > 0 && (
            <Card className="bg-white/[0.02] border-white/5">
              <CardHeader className="pb-2 border-b border-white/5">
                <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Open Tasks ({client.tasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-2">
                {client.tasks.map((t: any) => (
                  <div key={t.id} className="flex items-start gap-2 text-xs">
                    <Clock className="h-3.5 w-3.5 text-zinc-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-zinc-300">{t.title}</div>
                      {t.dueDate && <div className="text-zinc-600 mt-0.5">Due {new Date(t.dueDate).toLocaleDateString()}</div>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main content tabs */}
        <div className="md:col-span-2">
          <Tabs defaultValue="opportunities" className="w-full">
            <TabsList className="bg-white/5 border border-white/10 flex-wrap h-auto gap-1 p-1">
              {[
                { value: "opportunities", label: `Opportunities (${client.opportunities.length})` },
                { value: "tax", label: `Tax (${client.taxInsights.length})` },
                { value: "meetings", label: `Meetings (${client.meetings.length})` },
                 { value: "comms", label: `Comms (${client.communications.length})` },
                { value: "documents", label: `Docs (${client.documents.length})` },
                { value: "research", label: `Research (${client.researchMemos.length})` },
                { value: "audit", label: `Audit Trail (${auditLogs.length})` },
              ].map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="data-[state=active]:bg-white/10 text-xs">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Opportunities */}
            <TabsContent value="opportunities" className="mt-4 space-y-3">
              {client.opportunities.length === 0 && <Empty label="No opportunities on file." />}
              {client.opportunities.map((o: any) => (
                <OpportunityCard key={o.id} opportunity={o} />
              ))}
            </TabsContent>

            {/* Tax */}
            <TabsContent value="tax" className="mt-4 space-y-3">
              {client.taxInsights.length === 0 && <Empty label="No tax insights on file." />}
              {client.taxInsights.map((t: any) => (
                <TaxCard key={t.id} insight={t} />
              ))}
            </TabsContent>

            {/* Meetings */}
            <TabsContent value="meetings" className="mt-4 space-y-3">
              {client.meetings.length === 0 && <Empty label="No meetings on file." />}
              {client.meetings.map((m: any) => (
                <Card key={m.id} className="bg-white/[0.02] border-white/5">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium text-white/80 mb-0.5">{m.title}</div>
                        <div className="text-xs text-zinc-500">{new Date(m.scheduledAt).toLocaleDateString()} · {m.type}</div>
                        {m.notes && <p className="text-xs text-zinc-400 mt-1.5">{m.notes}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className={`text-[10px] ${m.status === "COMPLETED" ? "text-emerald-400 border-emerald-500/20" : "text-zinc-400 border-zinc-700"}`}>
                          {m.status}
                        </Badge>
                        {m.briefGenerated && (
                          <span className="text-[9px] text-primary/70 flex items-center gap-1"><Star className="h-2.5 w-2.5" />Brief ready</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Communications */}
            <TabsContent value="comms" className="mt-4 space-y-3">
              {client.communications.length === 0 && <Empty label="No communications on file." />}
              {client.communications.map((c: any) => (
                <Card key={c.id} className="bg-white/[0.02] border-white/5">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-zinc-300 truncate">{c.subject ?? c.type}</span>
                          <Badge className={`text-[10px] shrink-0 ${statusColors[c.status] ?? "text-zinc-400 bg-zinc-800 border-zinc-700"}`}>{c.status.replace("_", " ")}</Badge>
                        </div>
                        {c.body && <p className="text-xs text-zinc-500 line-clamp-2">{c.body}</p>}
                      </div>
                      <div className="text-[10px] text-zinc-700 whitespace-nowrap">{new Date(c.timestamp).toLocaleDateString()}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Documents */}
            <TabsContent value="documents" className="mt-4 space-y-3">
              {client.documents.length === 0 && <Empty label="No documents on file." />}
              {client.documents.map((d: any) => (
                <Card key={d.id} className="bg-white/[0.02] border-white/5">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-zinc-600 shrink-0" />
                        <div>
                          <div className="text-xs text-zinc-300">{d.fileName}</div>
                          <div className="text-[10px] text-zinc-600">{d.documentType?.replace(/_/g, " ") ?? "Unknown type"} · {(d.fileSize / 1_000_000).toFixed(1)} MB</div>
                        </div>
                      </div>
                      <Badge className={`text-[10px] ${d.status === "REVIEWED" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-zinc-400 bg-zinc-800 border-zinc-700"}`}>
                        {d.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Research */}
            <TabsContent value="research" className="mt-4 space-y-3">
              {client.researchMemos.length === 0 && <Empty label="No research memos on file." />}
              {client.researchMemos.map((r: any) => (
                <Card key={r.id} className="bg-white/[0.02] border-white/5">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-medium text-white/80">{r.title}</span>
                          <Badge className={`text-[10px] ${statusColors[r.status] ?? ""}`}>{r.status}</Badge>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2">{r.thesis}</p>
                        <div className="text-[10px] text-zinc-700 mt-1.5">{r.generatedBy}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="audit" className="mt-4">
              <AuditTimeline logs={auditLogs} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
    </>
  );
}

// ── internal sub-components ──────────────────────────────────────────────────

function OpportunityCard({ opportunity: o }: { opportunity: Opportunity }) {
  const [isPending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);
  const finding = parseFinding(o.reasoning);

  if (hidden) return null;

  return (
    <Card className={`bg-white/[0.02] border-white/5 transition-all duration-300 ${isPending ? "opacity-50 grayscale" : ""}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`text-[10px] ${statusColors[o.status] ?? ""}`}>{o.status.replace("_", " ")}</Badge>
              <span className="text-[10px] text-zinc-600 uppercase tracking-wide">{o.type.replace(/_/g, " ")}</span>
            </div>
            <p className="text-sm text-zinc-300 font-medium">{o.description}</p>
            <div className="mt-2">
              <ExplainableFindingPanel finding={finding} fallbackEvidence={o.evidence} />
            </div>
          </div>
          <div className="text-right shrink-0">
            {o.valueEst && <div className="text-sm font-bold text-primary">{fmt(o.valueEst)}</div>}
            <div className="text-[10px] text-zinc-600">{o.confidence}% conf.</div>
          </div>
        </div>
        
        {o.status === "DRAFT" && (
          <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-white/[0.04]">
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => startTransition(async () => {
                await dismissOpportunity(o.id);
                setHidden(true);
              })}
              className="h-7 text-[10px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
            >
              <X className="h-3 w-3 mr-1" /> Dismiss
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={isPending}
              onClick={() => startTransition(async () => {
                try {
                  const res = await approveOpportunity(o.id);
                  if (res?.escalated) {
                    toast.warning("Compliance Alert", { description: res.message });
                  } else {
                    toast.success("Opportunity executing", {
                      description: "Trade orders staged for institutional prime brokerage."
                    });
                  }
                  setHidden(true);
                } catch (err) {
                  toast.error("Security violation or system error.");
                }
              })}
              className="h-7 text-[10px] bg-primary/10 text-primary hover:bg-primary/20 border-primary/10"
            >
              <Check className="h-3 w-3 mr-1" /> Approve Draft
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TaxCard({ insight: t }: { insight: TaxInsight }) {
  const [isPending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <Card className={`bg-white/[0.02] border-white/5 transition-all duration-300 ${isPending ? "opacity-50 grayscale" : ""}`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${t.urgency === "HIGH" ? "text-red-400" : "text-amber-400"}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-white/80">{t.title}</span>
              <Badge className={`text-[10px] ${urgencyColors[t.urgency] ?? ""}`}>{t.urgency}</Badge>
              <Badge className={`text-[10px] ${statusColors[t.status] ?? ""}`}>{t.status.replace("_", " ")}</Badge>
            </div>
            <p className="text-xs text-zinc-400">{t.rationale}</p>
            <p className="text-xs text-zinc-500 mt-1 italic">{t.suggestedAction}</p>
            {t.estimatedImpact && <p className="text-xs text-emerald-400 mt-1">Impact: {t.estimatedImpact}</p>}
          </div>
        </div>

        {t.status === "UNDER_REVIEW" && (
          <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-white/[0.04]">
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => startTransition(async () => {
                const res = await reviewTaxInsight(t.id, "DISMISSED");
                if (res && !res.success) {
                  alert(res.error);
                  return;
                }
                setHidden(true);
              })}
              className="h-7 text-[10px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
            >
              <X className="h-3 w-3 mr-1" /> Dismiss
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={isPending}
              onClick={() => startTransition(async () => {
                try {
                  const res = await reviewTaxInsight(t.id, "ACCEPTED");
                  if (res && !res.success) {
                    toast.error("Action denied", { description: res.error });
                    return;
                  }
                  toast.success("Tax strategy accepted", {
                    description: "Moving to institutional execution phase."
                  });
                  setHidden(true);
                } catch (err) {
                  toast.error("Compliance error.");
                }
              })}
              className="h-7 text-[10px] bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/10"
            >
              <Check className="h-3 w-3 mr-1" /> Accept Insight
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-xs text-zinc-300 leading-relaxed">{value}</div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="py-8 text-center text-zinc-600 text-sm">{label}</div>;
}
