"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, AlertTriangle, TrendingUp, Users, DollarSign, Activity, Zap, X, Check, ShieldCheck, ArrowRight } from "lucide-react";
import { motion, Variants, AnimatePresence } from "framer-motion";
import { dismissOpportunity, approveOpportunity } from "@/lib/actions";
import { useTransition } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 }
  }
};

const item: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4 } }
};

interface Alert {
  id: string;
  title: string;
  client: string;
  description: string;
  severity: string;
  timestamp: Date;
  type?: string;
}

interface RevenueOpportunity {
  id: string;
  type: string;
  client: string;
  value: string;
  confidence: number;
  suggestedAction: string;
}

interface ChartItem {
  name: string;
  aum: number;
  type: string;
  month?: string;
}

interface DashboardProps {
  metrics: {
    aum: string;
    aumChange: string;
    activeClients: number;
    prospects: number;
    revenueOpportunities: string;
    churnRisk: number;
    taxReviewPending?: number;
    meetingsThisWeek?: number;
    tasksDue?: number;
    complianceFlags?: number;
  };
  alerts: Alert[];
  revenueEngine: RevenueOpportunity[];
  chartData?: ChartItem[];
  /** Set when the dashboard could not reach Postgres — shows setup guidance */
  offlineNotice?: string | null;
}

function MetricCard({ label, value, sub, icon: Icon, accent = "emerald", delay = "0s" }: {
  label: string; value: string | number; sub: React.ReactNode;
  icon: React.ElementType; accent?: "emerald" | "zinc" | "amber" | "rose";
  delay?: string;
}) {
  const accentMap = {
    emerald: { iconBg: "rgba(29,158,117,0.14)", iconColor: "#5DCAA5" },
    zinc: { iconBg: "rgba(255,255,255,0.08)", iconColor: "color-mix(in srgb, var(--foreground) 72%, transparent)" },
    amber: { iconBg: "rgba(239,159,39,0.15)", iconColor: "#EF9F27" },
    rose: { iconBg: "rgba(216,90,48,0.15)", iconColor: "#D85A30" },
  };
  const a = accentMap[accent];

  return (
    <div className="group relative glass animate-fade-up overflow-hidden p-6 transition-all duration-200 hover:-translate-y-[2px]" style={{ animationDelay: delay }}>
      <div className="absolute inset-x-0 top-0 h-px bg-white/12" />
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--muted-foreground)]">{label}</span>
          <div className="rounded-xl border p-2 transition-colors duration-200" style={{ background: a.iconBg, borderColor: "color-mix(in srgb, var(--border) 120%, transparent)" }}>
            <Icon className="h-4 w-4" style={{ color: a.iconColor }} strokeWidth={1.5} />
          </div>
        </div>
        <div className="text-[30px] font-light leading-none tracking-[-0.04em] text-[color:var(--foreground)]" data-mono>{value}</div>
        <div className="mt-3">{sub}</div>
      </div>
    </div>
  );
}

export function DashboardClient({ metrics, alerts, revenueEngine, chartData, offlineNotice }: DashboardProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto flex max-w-[1600px] flex-col gap-10 pb-16 text-[color:var(--foreground)]"
    >
      {offlineNotice ? (
        <div
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90"
        >
          <span className="font-medium text-amber-200">Database offline.</span> {offlineNotice}
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="rounded-full border px-3 py-1 text-xs font-medium"
              style={
                offlineNotice
                  ? { background: "rgba(239,159,39,0.12)", color: "#EF9F27", borderColor: "rgba(239,159,39,0.28)" }
                  : { background: "rgba(29,158,117,0.12)", color: "#5DCAA5", borderColor: "rgba(29,158,117,0.24)" }
              }
            >
              {offlineNotice ? "Demo / offline" : "Live"}
            </span>
          </div>
          <h1 className="text-4xl font-light leading-none tracking-[-0.05em] md:text-5xl">Executive Summary</h1>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--muted-foreground)]">Portfolio intelligence and revenue signals across your book of business.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/audit" className="glass inline-flex h-10 items-center justify-center rounded-full px-4 text-xs font-medium text-[color:var(--muted-foreground)] transition-all duration-200 hover:-translate-y-[1px] hover:text-[color:var(--foreground)]">
            <ShieldCheck className="mr-2 h-4 w-4" style={{ color: "color-mix(in srgb, var(--foreground) 58%, transparent)" }} strokeWidth={1.5} />
            Audit Ledger
          </Link>
          <Link href="/meetings" className="group inline-flex h-10 items-center justify-center rounded-full px-4 text-xs font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.97]" style={{ background: "#1D9E75", boxShadow: "0 18px 32px -20px rgba(29,158,117,0.72), inset 0 1px 0 rgba(255,255,255,0.16)" }}>
            Meeting Briefs
            <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </div>

      {/* Metric Cards — asymmetric bento: 2 wide + 2 narrow */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Total AUM"
          value={metrics.aum}
          accent="emerald"
          icon={DollarSign}
          delay="0s"
          sub={
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ color: "color-mix(in srgb, var(--foreground) 56%, transparent)", background: "color-mix(in srgb, var(--muted) 100%, transparent)", border: "0.5px solid color-mix(in srgb, var(--border) 110%, transparent)" }}>
              {metrics.aumChange.startsWith("No") ? metrics.aumChange : <><TrendingUp className="h-3 w-3 text-[#1D9E75]" strokeWidth={1.5} />{metrics.aumChange}</>}
            </span>
          }
        />
        <MetricCard
          label="Active Clients"
          value={metrics.activeClients}
          accent="emerald"
          icon={Users}
          delay="0.05s"
          sub={
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ color: "color-mix(in srgb, var(--foreground) 56%, transparent)", background: "color-mix(in srgb, var(--muted) 100%, transparent)", border: "0.5px solid color-mix(in srgb, var(--border) 110%, transparent)" }}>
              +{metrics.prospects} in pipeline
            </span>
          }
        />
        <MetricCard
          label="Detected Revenue"
          value={metrics.revenueOpportunities}
          accent="emerald"
          icon={Target}
          delay="0.1s"
          sub={
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ color: "#5DCAA5", background: "rgba(29,158,117,0.12)", border: "0.5px solid rgba(29,158,117,0.22)" }}>
              Live opportunities
            </span>
          }
        />
        <MetricCard
          label="Churn Risk"
          value={metrics.churnRisk}
          accent="emerald"
          icon={Activity}
          delay="0.15s"
          sub={
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ color: "#D85A30", background: "rgba(216,90,48,0.12)", border: "0.5px solid rgba(216,90,48,0.22)" }}>
              Needs contact
            </span>
          }
        />
      </motion.div>

      {/* Main content — asymmetric 5/2 split */}
      <div className="grid gap-8 lg:grid-cols-7">
        {/* Chart */}
        <motion.div variants={item} className="lg:col-span-4">
          <div className="glass animate-fade-up flex flex-col p-6" style={{ animationDelay: "0.2s" }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-medium">AUM by Client</h2>
                <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">Point-in-time snapshot across book of business</p>
              </div>
              <span className="text-xs font-medium text-[color:var(--muted-foreground)]">Realtime</span>
            </div>
              <div className="flex-1 min-h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData ?? []} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.30)" fontSize={11} tickLine={false} axisLine={false} dy={8} />
                    <YAxis stroke="rgba(255,255,255,0.30)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}M`} dx={-8} />
                    <Tooltip
                      contentStyle={{ background: "rgba(10,13,18,0.95)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "white", fontSize: "12px", fontFamily: "var(--font-dm-mono)", boxShadow: "0 20px 60px -15px rgba(0,0,0,0.5)" }}
                      itemStyle={{ color: "#1D9E75" }}
                      formatter={(value) => [`$${Number(value ?? 0)}M`, "AUM"]}
                    />
                    <Area type="monotone" dataKey="aum" stroke="#1D9E75" fillOpacity={1} fill="url(#colorAum)" strokeWidth={1.5} activeDot={{ r: 5, fill: "#1D9E75", stroke: "#0c0c0e", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
        </motion.div>

        {/* Priority Action Board */}
        <motion.div variants={item} className="lg:col-span-3">
          <div className="glass animate-fade-up flex h-full flex-col p-6" style={{ animationDelay: "0.25s" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-medium">Priority Actions</h2>
                <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">AI-flagged items requiring review</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#5DCAA5" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-[#1D9E75]" />
                Active
              </span>
            </div>
              <div className="flex-1 overflow-y-auto flex flex-col gap-3.5 min-h-[280px] max-h-[360px] pr-1 scrollbar-thin scrollbar-thumb-white/[0.06]">
                {alerts.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-[color:var(--muted-foreground)]">No pressing alerts.</div>
                ) : null}
                {alerts.map((alert, i) => (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={alert.id}
                    className="glass animate-fade-up flex cursor-pointer flex-col gap-3 p-5 transition-transform duration-200 hover:-translate-y-[2px]"
                    style={{ animationDelay: `${i * 0.05 + 0.3}s` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {alert.severity === 'critical' ? (
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ background: "rgba(216,90,48,0.15)", borderColor: "rgba(216,90,48,0.3)" }}><AlertTriangle className="h-3.5 w-3.5 text-[#D85A30]" strokeWidth={1.5} /></div>
                        ) : alert.severity === 'high' ? (
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ background: "rgba(239,159,39,0.15)", borderColor: "rgba(239,159,39,0.3)" }}><TrendingUp className="h-3.5 w-3.5 text-[#EF9F27]" strokeWidth={1.5} /></div>
                        ) : alert.severity === 'warning' ? (
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ background: "rgba(239,159,39,0.15)", borderColor: "rgba(239,159,39,0.3)" }}><AlertTriangle className="h-3.5 w-3.5 text-[#EF9F27]" strokeWidth={1.5} /></div>
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ background: "rgba(29,158,117,0.14)", borderColor: "rgba(29,158,117,0.24)" }}><Target className="h-3.5 w-3.5 text-[#5DCAA5]" strokeWidth={1.5} /></div>
                        )}
                        <span className="text-sm font-medium text-[color:var(--foreground)]">{alert.title}</span>
                      </div>
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs font-medium" style={alert.severity === "critical" ? { background: "rgba(216,90,48,0.12)", color: "#D85A30", borderColor: "rgba(216,90,48,0.3)" } : { background: "color-mix(in srgb, var(--muted) 100%, transparent)", color: "color-mix(in srgb, var(--foreground) 58%, transparent)", borderColor: "color-mix(in srgb, var(--border) 110%, transparent)" }}>
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="pl-6 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
                      <span className="font-medium text-[color:var(--foreground)]">{alert.client}: </span>
                      {alert.description}
                    </p>
                  </motion.div>
                ))}
              </div>
          </div>
        </motion.div>
      </div>

      {/* Revenue Engine */}
      <motion.div variants={item}>
        <div className="glass animate-fade-up overflow-hidden" style={{ animationDelay: "0.35s" }}>
            <div className="flex items-center justify-between border-b p-6 pb-5" style={{ borderBottomColor: "color-mix(in srgb, var(--border) 95%, transparent)" }}>
              <div className="flex items-center gap-3">
                <div className="rounded-xl border p-2" style={{ background: "rgba(239,159,39,0.15)", borderColor: "rgba(239,159,39,0.24)" }}>
                  <Zap className="h-4 w-4 text-[#EF9F27]" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-lg font-medium">Revenue Engine</h2>
                  <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">Draft opportunities awaiting advisor action</p>
                </div>
              </div>
              <Badge variant="outline" className="rounded-full text-xs font-medium" style={{ color: "color-mix(in srgb, var(--foreground) 58%, transparent)", background: "color-mix(in srgb, var(--muted) 100%, transparent)", borderColor: "color-mix(in srgb, var(--border) 110%, transparent)" }}>{revenueEngine.length} drafts</Badge>
            </div>
            <div className="p-6 pt-5">
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {revenueEngine.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-sm text-[color:var(--muted-foreground)]">No draft opportunities available.</div>
                ) : null}
                <AnimatePresence>
                {revenueEngine.map((opp) => (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={opp.id}
                    className="glass animate-fade-up flex min-h-[200px] flex-col justify-between overflow-hidden p-5 transition-transform duration-200 hover:-translate-y-[2px]"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <Badge variant="outline" className="text-xs font-medium" style={{ background: "rgba(29,158,117,0.12)", color: "#5DCAA5", borderColor: "rgba(29,158,117,0.24)" }}>{opp.type}</Badge>
                        <span className="rounded-full border px-2 py-1 text-xs font-semibold" style={{ color: "#5DCAA5", background: "rgba(29,158,117,0.12)", borderColor: "rgba(29,158,117,0.24)" }}>{opp.confidence}%</span>
                      </div>
                      <h3 className="text-base font-semibold text-[color:var(--foreground)]">{opp.client}</h3>
                      <div className="mt-0.5 text-2xl font-light text-[color:var(--foreground)]" data-mono>{opp.value}</div>
                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[color:var(--muted-foreground)]">{opp.suggestedAction}</p>
                    </div>

                    <div className="flex gap-2 mt-5">
                      <Button
                        disabled={isPending}
                        onClick={() => startTransition(() => dismissOpportunity(opp.id))}
                        className="flex-1 h-8 text-xs font-medium transition-colors duration-200"
                        style={{ color: "color-mix(in srgb, var(--foreground) 58%, transparent)" }}
                        variant="outline"
                        size="sm"
                      >
                        <X className="mr-1 h-4 w-4" strokeWidth={1.5} /> Dismiss
                      </Button>
                      <Button
                        disabled={isPending}
                        onClick={() => startTransition(async () => { await approveOpportunity(opp.id); })}
                        className="flex-1 h-8 text-xs font-medium text-white transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
                        style={{ background: "#1D9E75" }}
                        size="sm"
                      >
                        <Check className="mr-1 h-4 w-4" strokeWidth={1.5} /> Approve
                      </Button>
                    </div>
                  </motion.div>
                ))}
                </AnimatePresence>
              </div>
            </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
