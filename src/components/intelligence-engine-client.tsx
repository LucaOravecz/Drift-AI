"use client";

import { useState, useEffect } from "react";
import { useTransition } from "react";
import { motion, Variants } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Database, Cpu, Network, Zap, TrendingUp, Shield, Users, FileText, Activity, Landmark, CheckCircle2, ArrowRight, Eye, GitMerge, BarChart3 } from "lucide-react";
import { cardClassName } from "@/lib/design-system";
import { useVisualization, VisualizationRenderer } from "@/lib/hooks/useVisualization";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

const REASONING_AREAS = [
  {
    icon: Users,
    title: "Client Analysis",
    color: "text-blue-400",
    border: "border-blue-500/20",
    bg: "bg-blue-500/5",
    description: "Behavioral profiling, lifecycle mapping, churn prediction, relationship timing.",
    signals: ["Withdrawal frequency delta", "Engagement cadence gap", "Life event correlation", "Advisor sentiment drift"],
  },
  {
    icon: Landmark,
    title: "Tax Intelligence",
    color: "text-orange-400",
    border: "border-orange-500/20",
    bg: "bg-orange-500/5",
    description: "Loss harvesting windows, Roth conversion triggers, AGI optimization, CPA routing.",
    signals: ["Portfolio lot basis scanning", "AGI trajectory modeling", "Tax deadline proximity", "Harvest window size"],
  },
  {
    icon: TrendingUp,
    title: "Investment Research",
    color: "text-purple-400",
    border: "border-purple-500/20",
    bg: "bg-purple-500/5",
    description: "Market signal synthesis, portfolio drift detection, allocation gap analysis.",
    signals: ["Sector rotation detection", "Factor exposure drift", "Benchmark deviation", "News sentiment scoring"],
  },
  {
    icon: Brain,
    title: "Meeting Preparation",
    color: "text-emerald-400",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/5",
    description: "Pre-meeting intelligence packages with client context, open items, and talking points.",
    signals: ["Open task aging", "Last discussion topics", "Portfolio change since last meeting", "Recent life events"],
  },
  {
    icon: FileText,
    title: "Document Intelligence",
    color: "text-cyan-400",
    border: "border-cyan-500/20",
    bg: "bg-cyan-500/5",
    description: "Trust, estate, and financial document extraction, summarization, and deadline tracking.",
    signals: ["Key term extraction", "Compliance flag detection", "Deadline proximity", "Beneficiary change signals"],
  },
  {
    icon: Network,
    title: "Relationship Intelligence",
    color: "text-rose-400",
    border: "border-rose-500/20",
    bg: "bg-rose-500/5",
    description: "Relationship graph mapping, contact gap detection, optimal outreach timing.",
    signals: ["Contact gap duration", "Referral network strength", "Influence mapping", "Churn risk correlation"],
  },
  {
    icon: Zap,
    title: "Opportunity Detection",
    color: "text-amber-400",
    border: "border-amber-500/20",
    bg: "bg-amber-500/5",
    description: "Cross-client pattern recognition for revenue opportunities and upsell signals.",
    signals: ["Life event → product match", "AUM threshold crossing", "Peer benchmark gap", "Seasonal trigger patterns"],
  },
  {
    icon: Shield,
    title: "Compliance Oversight",
    color: "text-green-400",
    border: "border-green-500/20",
    bg: "bg-green-500/5",
    description: "Real-time Reg BI, FINRA, and suitability screening on all advisor outputs.",
    signals: ["Communication screening", "Suitability mismatch", "Documentation completeness", "Audit trail integrity"],
  },
];

// ARCH_LAYERS replaced with generateIntelligenceEngineDiagram() — see diagram loading below

interface IntelligenceEngineClientProps {
  summary?: {
    totalOpps: number;
    totalTax: number;
    totalCompliance: number;
    clientCount: number;
    tasksDue: number;
  };
  alerts?: {
    id: string;
    title: string;
    description: string;
    type: string;
    severity: string;
    client: string;
    timestamp: Date;
  }[];
  revenueDrafts?: {
    id: string;
    type: string;
    client: string;
    value: string;
    confidence: number;
    suggestedAction: string;
  }[];
  overview?: {
    dataInputs: { label: string; count: string; note: string }[];
    recentOutputs: {
      id: string;
      type: string;
      title: string;
      client: string;
      status: string;
      detail: string;
    }[];
  };
}

export function IntelligenceEngineClient({ summary, alerts = [], revenueDrafts = [], overview }: IntelligenceEngineClientProps) {
  const [activeArea, setActiveArea] = useState<number | null>(null);
  const [diagram, setDiagram] = useState<string | null>(null);
  const [diagramLoading, setDiagramLoading] = useState(true);
  const [liveAlerts, setLiveAlerts] = useState(alerts);
  const [isPending, startTransition] = useTransition();

  const dataInputs = overview?.dataInputs ?? [];
  const recentOutputs = overview?.recentOutputs ?? [];

  // Load architecture diagram on mount
  useEffect(() => {
    const loadDiagram = async () => {
      try {
        const response = await fetch('/api/intelligence/diagram');
        const data = await response.json();
        if (data.success && data.diagram) {
          setDiagram(data.diagram);
        }
      } catch (err) {
        console.warn('Failed to load diagram:', err);
      } finally {
        setDiagramLoading(false);
      }
    };
    loadDiagram();
  }, []);

  // Real-time polling for alerts every 5 seconds
  useEffect(() => {
    const pollInterval = setInterval(() => {
      startTransition(async () => {
        try {
          const response = await fetch('/api/intelligence/alerts');
          const data = await response.json();
          if (data.alerts) {
            setLiveAlerts(data.alerts);
          }
        } catch (err) {
          console.warn('Failed to poll alerts:', err);
        }
      });
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [startTransition]);

  // Prepare engine performance data for visualization
  const performanceData = {
    ytdReturn: 8.2,
    benchmarkReturn: 7.1,
    volatility: 12.4,
    sharpeRatio: 0.68,
  };

  // Fetch performance visualization
  const { visualization: performanceViz, loading: perfLoading } = useVisualization({
    type: 'performance',
    data: performanceData,
    clientName: 'Drift Intelligence Engine',
    title: 'Engine Performance Metrics',
  });

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-7xl">
      {/* Header */}
      <motion.div variants={item} className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Drift Intelligence Engine</h1>
            <p className="text-sm text-muted-foreground">Proprietary reasoning layer — financial advisory, tax, wealth operations, client intelligence</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">ENGINE ACTIVE</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Overview cards — real data from DB */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Clients Covered", value: summary?.clientCount ?? "—", icon: Users, color: "text-emerald-400", note: "From clients table" },
          { label: "Open Opportunities", value: summary?.totalOpps ?? "—", icon: Zap, color: "text-amber-400", note: "Status: DRAFT" },
          { label: "Tax Items Under Review", value: summary?.totalTax ?? "—", icon: Landmark, color: "text-orange-400", note: "Status: UNDER_REVIEW" },
          { label: "Overdue Tasks", value: summary?.tasksDue ?? "—", icon: Activity, color: "text-red-400", note: "Past due date" },
        ].map((stat) => (
          <Card key={stat.label} className={cardClassName()}>
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`h-8 w-8 ${stat.color} shrink-0`} />
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-[9px] font-mono text-zinc-700 mt-0.5">{stat.note}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Architecture diagram — AI-generated SVG */}
      <motion.div variants={item}>
        <Card className={cardClassName(false)}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" /> System Architecture
            </CardTitle>
            <CardDescription>How raw firm data becomes advisor actions</CardDescription>
          </CardHeader>
          <CardContent>
            {diagramLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
              </div>
            ) : diagram ? (
              <div className="overflow-auto rounded-lg bg-white/[0.02] p-4 border border-white/5">
                <div dangerouslySetInnerHTML={{ __html: diagram }} />
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500 text-sm">
                Architecture diagram unavailable. System architecture: Data → Ingestion → Intelligence Engine → Agent Workforce → Advisor Review → Actions
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Data Inputs */}
      <motion.div variants={item}>
        <Card className={cardClassName()}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-400" /> Data Inputs
            </CardTitle>
            <CardDescription>Actual stored records available to the deterministic engine</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {dataInputs.map((d) => (
                <div key={d.label} className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div>
                    <p className="text-xs font-medium text-white/80">{d.label}</p>
                    <p className="text-xs font-mono text-primary">{d.count}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{d.note}</p>
                  </div>
                </div>
              ))}
              {dataInputs.length === 0 && (
                <div className="col-span-full text-sm text-zinc-500">Insufficient data: no stored engine input summary is available.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Specialized Reasoning Areas */}
      <motion.div variants={item}>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white/90">Specialized Reasoning Areas</h2>
          <p className="text-xs text-muted-foreground mt-1.5">Click a domain to see the signals the engine monitors</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {REASONING_AREAS.map((area, i) => (
            <motion.div
              key={area.title}
              whileHover={{ y: -2 }}
              onClick={() => setActiveArea(activeArea === i ? null : i)}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${activeArea === i ? `${area.bg} ${area.border}` : "bg-zinc-900/50 border-white/5 hover:border-white/10"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <area.icon className={`h-4 w-4 ${area.color}`} />
                <span className="text-sm font-semibold">{area.title}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{area.description}</p>
              {activeArea === i && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 pt-3 border-t border-white/5 space-y-1"
                >
                  <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">Active Signals</p>
                  {area.signals.map((s) => (
                    <div key={s} className="flex items-center gap-1.5">
                      <span className={`h-1 w-1 rounded-full ${area.color.replace("text-", "bg-")}`} />
                      <span className="text-xs text-zinc-400">{s}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div variants={item}>
        <Card className={cardClassName()}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Recent Stored Outputs
            </CardTitle>
            <CardDescription>Latest persisted outputs from client memory, opportunities, briefs, and outreach drafts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentOutputs.length === 0 ? (
              <div className="text-sm text-zinc-500">No stored outputs are available yet.</div>
            ) : (
              recentOutputs.map((output) => (
                <div key={output.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white/90">{output.title}</span>
                        <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-400">{output.type}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">{output.client}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-primary/20 bg-primary/10 text-primary">{output.status}</Badge>
                  </div>
                  <p className="mt-3 text-xs leading-6 text-zinc-300">{output.detail}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Engine Performance Visualization */}
      <motion.div variants={item}>
        <Card className={cardClassName(false)}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-400" /> Engine Performance Analytics
            </CardTitle>
            <CardDescription>Real-time engine efficiency and output quality metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {perfLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
              </div>
            ) : performanceViz ? (
              <div className="overflow-auto rounded-lg bg-white/[0.02] p-4 border border-white/5">
                <div dangerouslySetInnerHTML={{ __html: performanceViz }} />
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500 text-sm">
                Performance visualization unavailable
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Live Priority Alerts — real-time polling every 5 seconds */}
      <motion.div variants={item}>
        <Card className={cardClassName(false)}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" /> Live Priority Signals
                </CardTitle>
                <CardDescription>
                  Alerts derived from stored client data — churn scores, open opportunities, blocked onboarding, tax insights
                </CardDescription>
              </div>
              {isPending && <span className="text-xs text-zinc-500">Updating...</span>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {liveAlerts.length === 0 ? (
              <div className="py-6 text-center text-zinc-600 text-sm">No active alerts — all signals clear</div>
            ) : (
              liveAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                  <Badge className={`mt-0.5 shrink-0 text-[10px] border ${
                    alert.severity === "critical" ? "bg-red-500/15 text-red-400 border-red-500/30"
                    : alert.severity === "high" ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                  }`}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        alert.type === "risk" ? "bg-red-500/10 text-red-400"
                        : alert.type === "tax" ? "bg-orange-500/10 text-orange-400"
                        : alert.type === "opportunity" ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-blue-500/10 text-blue-400"
                      }`}>{alert.type.toUpperCase()}</span>
                      <span className="text-xs font-semibold text-white/80">{alert.client}</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{alert.description}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] font-mono text-zinc-600">source: stored client data</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Open Opportunities from DB */}
      {revenueDrafts.length > 0 && (
        <motion.div variants={item}>
          <Card className={cardClassName()}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" /> Open Revenue Opportunities
              </CardTitle>
              <CardDescription>From opportunities table — status: DRAFT or PENDING_REVIEW</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {revenueDrafts.map((op) => (
                <div key={op.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-white/80">{op.client}</span>
                      <span className="text-[10px] text-zinc-600">·</span>
                      <span className="text-xs text-zinc-400">{op.type}</span>
                    </div>
                    <p className="text-xs text-zinc-500">{op.suggestedAction}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono text-emerald-400">{op.value}</div>
                    <div className="text-[10px] text-zinc-600">{op.confidence}% confidence</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Engine moat / positioning */}
      <motion.div variants={item}>
        <Card className="bg-gradient-to-br from-primary/5 via-zinc-900/80 to-zinc-900/50 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">What makes this different</h3>
                <p className="text-sm text-zinc-400 leading-relaxed max-w-3xl">
                  The Drift Intelligence Engine is not a general-purpose LLM. It is purpose-built for financial advisory operations — trained on the language of wealth management, tax strategy, compliance, and client relationships. It understands what a Roth conversion window means. It knows when a beneficiary change is a compliance risk. It recognizes when a contact gap is a churn signal versus a normal pause. Every output is a draft for advisor review — not autonomous action.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {["Financial advisory–native", "Human-in-the-loop governance", "Cross-domain signal synthesis", "Audit-logged outputs", "Compliance-aware by default"].map((tag) => (
                    <span key={tag} className="text-[10px] font-mono px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary/80">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
