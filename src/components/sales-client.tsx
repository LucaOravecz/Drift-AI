"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Mail, ChevronRight, Sparkles, TrendingUp, Loader2, BarChart2 } from "lucide-react";
import { motion } from "framer-motion";
import { advanceProspectStage } from "@/lib/actions";

const scoreBg: Record<string, string> = {
  hot: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  warm: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  cold: "bg-zinc-800/50 border-white/10 text-zinc-500",
};

function getScoreKey(score: number) {
  if (score >= 85) return "hot";
  if (score >= 65) return "warm";
  return "cold";
}

const stageLabels: Record<string, string> = {
  LEAD: "Lead",
  QUALIFIED: "Qualified",
  DISCOVERY: "Discovery",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Won",
  CLOSED_LOST: "Lost",
};

export function SalesClient({ prospects, campaigns, stats }: { prospects: any[]; campaigns: any[]; stats: any }) {
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localProspects, setLocalProspects] = useState(prospects);

  const advance = (id: string) => {
    setActiveId(id);
    startTransition(async () => {
      await advanceProspectStage(id);
      const stageOrder = ["LEAD","QUALIFIED","DISCOVERY","PROPOSAL","NEGOTIATION","CLOSED_WON"];
      setLocalProspects((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const idx = stageOrder.indexOf(p.stage);
          return { ...p, stage: idx < stageOrder.length - 1 ? stageOrder[idx + 1] : p.stage };
        })
      );
      setActiveId(null);
    });
  };

  const active = localProspects.filter((p) => !["CLOSED_WON", "CLOSED_LOST"].includes(p.stage));
  const closed = localProspects.filter((p) => ["CLOSED_WON", "CLOSED_LOST"].includes(p.stage));

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white/90">Sales & Leads</h1>
          <p className="text-zinc-400 mt-1">Inbound capture, outbound automation, and pipeline intelligence.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 shadow-[0_0_15px_rgba(var(--primary),0.3)] text-primary-foreground">
          Add Lead
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white/[0.02] border-white/5">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-zinc-500 mt-1">Total Prospects</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/10">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-emerald-400">{stats.hot}</div>
            <div className="text-xs text-zinc-500 mt-1">Hot Leads (80+)</div>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.02] border-white/5">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-primary">{stats.totalPipelineAum}</div>
            <div className="text-xs text-zinc-500 mt-1">Pipeline AUM</div>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.02] border-white/5">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-amber-400">{stats.byStage?.PROPOSAL ?? 0}</div>
            <div className="text-xs text-zinc-500 mt-1">In Proposal Stage</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pipeline" className="w-full">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="pipeline" className="data-[state=active]:bg-white/10">Pipeline</TabsTrigger>
          <TabsTrigger value="campaigns" className="data-[state=active]:bg-white/10">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-5">
          <div className="flex flex-col gap-4">
            {active.map((prospect) => (
              <motion.div key={prospect.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-white/[0.02] border-white/5 hover:border-white/10 transition-colors">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <span className="font-semibold text-white/90">{prospect.name}</span>
                          <Badge className={`text-[10px] font-mono ${scoreBg[getScoreKey(prospect.score)]}`}>
                            Score {prospect.score}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-500">
                            {stageLabels[prospect.stage] ?? prospect.stage}
                          </Badge>
                          {prospect.campaign && (
                            <Badge variant="outline" className="text-[10px] border-primary/20 text-primary/70">
                              {prospect.campaign.name}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-primary mb-1.5">
                          {prospect.estimatedAum
                            ? `Est. $${(prospect.estimatedAum / 1000000).toFixed(1)}M`
                            : "AUM TBD"}
                        </div>
                        {prospect.aiInsight && (
                          <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg mb-2">
                            <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-zinc-400">
                              <strong className="text-amber-400">AI Insight:</strong> {prospect.aiInsight}
                            </p>
                          </div>
                        )}
                        {prospect.nextAction && (
                          <div className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                            <ChevronRight className="h-3 w-3 text-primary" />
                            Next: {prospect.nextAction}
                          </div>
                        )}
                        {prospect.notes && (
                          <div className="text-xs text-zinc-600 mt-1 italic">{prospect.notes}</div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-primary hover:bg-primary/90"
                          disabled={isPending && activeId === prospect.id}
                          onClick={() => advance(prospect.id)}
                        >
                          {isPending && activeId === prospect.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <><ChevronRight className="mr-1 h-3 w-3" />Advance Stage</>
                          )}
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs border-white/10 text-zinc-400">
                          <Mail className="mr-1 h-3 w-3" />Draft Email
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {active.length === 0 && (
              <Card className="bg-white/[0.01] border-white/5 border-dashed">
                <CardContent className="py-12 text-center text-zinc-600">No active prospects in pipeline.</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-5">
          <div className="grid gap-4 md:grid-cols-2">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} className="bg-white/[0.02] border-white/5">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base text-white/90">{campaign.name}</CardTitle>
                    <Badge className={campaign.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-800 text-zinc-500"}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">{campaign.type.replace(/_/g, " ")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-white/80">{campaign.targetCount}</div>
                      <div className="text-[10px] text-zinc-600">Targets</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-primary">{campaign.openRate?.toFixed(1) ?? "—"}%</div>
                      <div className="text-[10px] text-zinc-600">Open Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-emerald-400">{campaign.replyRate?.toFixed(1) ?? "—"}%</div>
                      <div className="text-[10px] text-zinc-600">Reply Rate</div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-xs text-zinc-600">{campaign.prospects?.length ?? 0} prospects enrolled</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 text-zinc-400">View</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
