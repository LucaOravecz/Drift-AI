"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, AlertTriangle, TrendingUp, Users, DollarSign, Activity, Zap, Loader2, X, Check, ShieldCheck, ArrowRight } from "lucide-react";
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

const easeOut: string = "cubic-bezier(0.23, 1, 0.32, 1)";
const easeSpring = { type: "spring" as const, stiffness: 260, damping: 25 };

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 }
  }
};

const item: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { ...easeSpring } }
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
}

function MetricCard({ label, value, sub, icon: Icon, accent = "emerald" }: {
  label: string; value: string | number; sub: React.ReactNode;
  icon: React.ElementType; accent?: "emerald" | "zinc" | "amber" | "rose";
}) {
  const accentMap = {
    emerald: { iconBg: "bg-emerald-500/10 group-hover:bg-emerald-500/20", iconColor: "text-emerald-400", dot: "bg-emerald-500" },
    zinc: { iconBg: "bg-zinc-500/10 group-hover:bg-zinc-500/20", iconColor: "text-zinc-400", dot: "bg-zinc-400" },
    amber: { iconBg: "bg-amber-500/10 group-hover:bg-amber-500/20", iconColor: "text-amber-400", dot: "bg-amber-500" },
    rose: { iconBg: "bg-rose-500/10 group-hover:bg-rose-500/20", iconColor: "text-rose-400", dot: "bg-rose-500" },
  };
  const a = accentMap[accent];

  return (
    <div className="group relative">
      <div className="rounded-[1.25rem] ring-1 ring-white/[0.06] bg-white/[0.03] p-1.5 transition-all duration-700 hover:ring-white/[0.12] hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
        <div className="rounded-[calc(1.25rem-0.375rem)] bg-[#0c0c0e] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</span>
            <div className={`p-1.5 rounded-lg ${a.iconBg} transition-colors duration-300`}>
              <Icon className={`h-3.5 w-3.5 ${a.iconColor}`} strokeWidth={1.5} />
            </div>
          </div>
          <div className="text-[2rem] font-bold tracking-tight text-zinc-50 leading-none">{value}</div>
          <div className="mt-3">{sub}</div>
        </div>
      </div>
    </div>
  );
}

export function DashboardClient({ metrics, alerts, revenueEngine, chartData }: DashboardProps) {
  const [isBooting, setIsBooting] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 1400);
    const progressTimer = setInterval(() => {
      setBootProgress((p) => Math.min(p + (Math.random() * 12), 100));
    }, 90);
    return () => { clearTimeout(timer); clearInterval(progressTimer); };
  }, []);

  if (isBooting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70dvh] gap-6 text-center">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-32 h-32 bg-emerald-500/15 rounded-full blur-3xl animate-pulse" />
          <div className="relative z-10 p-5 bg-[#0c0c0e] ring-1 ring-white/[0.06] rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]">
            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" strokeWidth={1.5} />
          </div>
        </div>
        <div className="flex flex-col gap-3 max-w-xs w-full px-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold tracking-tight text-zinc-50">Drift OS</h2>
            <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-[0.2em]">
              {bootProgress < 30 ? "Initializing Secure Core" : bootProgress < 60 ? "Indexing Portfolio Data" : "Calibrating Engine"}
            </p>
          </div>
          <div className="w-full h-0.5 bg-white/[0.04] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${bootProgress}%` }}
              className="h-full bg-emerald-500 rounded-full"
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-zinc-700">
            <span>SECURE_BOOT</span>
            <span>{Math.round(bootProgress)}%</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-10 pb-16 max-w-[1600px] mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] font-semibold bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">Live</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-zinc-50 leading-none">Executive Summary</h1>
          <p className="text-zinc-500 text-sm mt-2 max-w-[65ch] leading-relaxed">Portfolio intelligence and revenue signals across your book of business.</p>
        </div>
        <div className="flex gap-2.5">
          <Link href="/audit" className="group inline-flex h-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-xs font-medium text-zinc-400 transition-all duration-300 hover:bg-white/[0.06] hover:text-zinc-200 hover:border-white/[0.14] active:scale-[0.97]">
            <ShieldCheck className="mr-2 h-3.5 w-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors" strokeWidth={1.5} />
            Audit Ledger
          </Link>
          <Link href="/meetings" className="group inline-flex h-9 items-center justify-center rounded-full bg-emerald-500 px-4 text-xs font-semibold text-[#0c0c0e] transition-all duration-300 hover:bg-emerald-400 active:scale-[0.97]">
            Meeting Briefs
            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#0c0c0e]/10 group-hover:bg-[#0c0c0e]/20 transition-colors">
              <ArrowRight className="h-3 w-3" strokeWidth={2} />
            </span>
          </Link>
        </div>
      </div>

      {/* Metric Cards — asymmetric bento: 2 wide + 2 narrow */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total AUM"
          value={metrics.aum}
          accent="emerald"
          icon={DollarSign}
          sub={
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 bg-white/[0.03] ring-1 ring-white/[0.05] rounded-full px-2 py-0.5">
              {metrics.aumChange.startsWith("No") ? metrics.aumChange : <><TrendingUp className="h-3 w-3 text-emerald-400" strokeWidth={1.5} />{metrics.aumChange}</>}
            </span>
          }
        />
        <MetricCard
          label="Active Clients"
          value={metrics.activeClients}
          accent="zinc"
          icon={Users}
          sub={
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 bg-white/[0.03] ring-1 ring-white/[0.05] rounded-full px-2 py-0.5">
              +{metrics.prospects} in pipeline
            </span>
          }
        />
        <MetricCard
          label="Detected Revenue"
          value={metrics.revenueOpportunities}
          accent="amber"
          icon={Target}
          sub={
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-400/80 bg-amber-500/[0.06] ring-1 ring-amber-500/[0.12] rounded-full px-2 py-0.5">
              Live opportunities
            </span>
          }
        />
        <MetricCard
          label="Churn Risk"
          value={metrics.churnRisk}
          accent="rose"
          icon={Activity}
          sub={
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-400/80 bg-rose-500/[0.06] ring-1 ring-rose-500/[0.12] rounded-full px-2 py-0.5">
              Needs contact
            </span>
          }
        />
      </motion.div>

      {/* Main content — asymmetric 5/2 split */}
      <div className="grid gap-5 lg:grid-cols-7">
        {/* Chart — double-bezel */}
        <motion.div variants={item} className="lg:col-span-4">
          <div className="rounded-[1.5rem] ring-1 ring-white/[0.06] bg-white/[0.02] p-1.5">
            <div className="rounded-[calc(1.5rem-0.375rem)] bg-[#0c0c0e] p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-100">AUM by Client</h2>
                  <p className="text-xs text-zinc-600 mt-0.5">Point-in-time snapshot across book of business</p>
                </div>
                <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">Realtime</span>
              </div>
              <div className="flex-1 min-h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData ?? []} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} dy={8} />
                    <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}M`} dx={-8} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0c0c0e", borderColor: "rgba(255,255,255,0.08)", borderRadius: "12px", color: "white", fontSize: "12px", boxShadow: "0 20px 60px -15px rgba(0,0,0,0.5)" }}
                      itemStyle={{ color: "#34d399" }}
                      formatter={(value) => [`$${Number(value ?? 0)}M`, "AUM"]}
                    />
                    <Area type="monotone" dataKey="aum" stroke="#34d399" fillOpacity={1} fill="url(#colorAum)" strokeWidth={1.5} activeDot={{ r: 5, fill: "#34d399", stroke: "#0c0c0e", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Priority Action Board */}
        <motion.div variants={item} className="lg:col-span-3">
          <div className="rounded-[1.5rem] ring-1 ring-white/[0.06] bg-white/[0.02] p-1.5 h-full">
            <div className="rounded-[calc(1.5rem-0.375rem)] bg-[#0c0c0e] p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] flex flex-col h-full">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Priority Actions</h2>
                  <p className="text-xs text-zinc-600 mt-0.5">AI-flagged items requiring review</p>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 min-h-[280px] max-h-[360px] pr-1 scrollbar-thin scrollbar-thumb-white/[0.06]">
                {alerts.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-600">No pressing alerts.</div>
                ) : null}
                {alerts.map((alert, i) => (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + (i * 0.04), ...easeSpring }}
                    key={alert.id}
                    className="group flex flex-col gap-1.5 p-3.5 rounded-xl ring-1 ring-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] hover:ring-white/[0.08] transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {alert.severity === 'critical' ? (
                          <div className="p-1 bg-rose-500/10 rounded-md"><AlertTriangle className="h-3 w-3 text-rose-400" strokeWidth={1.5} /></div>
                        ) : alert.severity === 'high' ? (
                          <div className="p-1 bg-amber-500/10 rounded-md"><TrendingUp className="h-3 w-3 text-amber-400" strokeWidth={1.5} /></div>
                        ) : alert.severity === 'warning' ? (
                          <div className="p-1 bg-amber-500/10 rounded-md"><AlertTriangle className="h-3 w-3 text-amber-400" strokeWidth={1.5} /></div>
                        ) : (
                          <div className="p-1 bg-emerald-500/10 rounded-md"><Target className="h-3 w-3 text-emerald-400" strokeWidth={1.5} /></div>
                        )}
                        <span className="text-sm font-medium text-zinc-200">{alert.title}</span>
                      </div>
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className={`text-[9px] uppercase tracking-wider font-bold ${alert.severity === 'critical' ? '' : 'bg-white/[0.04] text-zinc-500 ring-1 ring-white/[0.05]'}`}>
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-zinc-500 pl-7 leading-relaxed">
                      <span className="font-medium text-zinc-400">{alert.client}: </span>
                      {alert.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Revenue Engine */}
      <motion.div variants={item}>
        <div className="rounded-[1.5rem] ring-1 ring-white/[0.06] bg-white/[0.02] p-1.5">
          <div className="rounded-[calc(1.5rem-0.375rem)] bg-[#0c0c0e] shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
            <div className="flex items-center justify-between p-6 pb-5 border-b border-white/[0.04]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-xl ring-1 ring-amber-500/15">
                  <Zap className="h-4 w-4 text-amber-400" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Revenue Engine</h2>
                  <p className="text-xs text-zinc-600 mt-0.5">Draft opportunities awaiting advisor action</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono text-zinc-500 bg-white/[0.02] ring-1 ring-white/[0.05] rounded-full">{revenueEngine.length} drafts</Badge>
            </div>
            <div className="p-6 pt-5">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {revenueEngine.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-sm text-zinc-600">No draft opportunities available.</div>
                ) : null}
                <AnimatePresence>
                {revenueEngine.map((opp) => (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94, filter: "blur(4px)" }}
                    whileHover={{ y: -3 }}
                    transition={{ ...easeSpring }}
                    key={opp.id}
                    className="group relative flex flex-col justify-between min-h-[200px] p-5 rounded-2xl ring-1 ring-white/[0.04] bg-white/[0.02] hover:ring-white/[0.1] hover:bg-white/[0.04] transition-all duration-500 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-3">
                        <Badge variant="outline" className="bg-emerald-500/[0.06] text-emerald-400 ring-emerald-500/15 text-[10px] font-medium">{opp.type}</Badge>
                        <span className="text-[10px] font-mono font-bold text-emerald-400/70 bg-emerald-500/[0.06] ring-1 ring-emerald-500/[0.1] px-2 py-0.5 rounded-full">{opp.confidence}%</span>
                      </div>
                      <h3 className="text-base font-semibold text-zinc-100">{opp.client}</h3>
                      <div className="text-2xl font-bold tracking-tight text-zinc-50 mt-0.5">{opp.value}</div>
                      <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed line-clamp-2">{opp.suggestedAction}</p>
                    </div>

                    <div className="flex gap-2 mt-5 relative z-10">
                      <Button
                        disabled={isPending}
                        onClick={() => startTransition(() => dismissOpportunity(opp.id))}
                        className="flex-1 h-8 bg-white/[0.03] ring-1 ring-white/[0.06] hover:bg-rose-500/10 hover:text-rose-400 hover:ring-rose-500/20 text-zinc-500 text-xs font-medium transition-all duration-200 active:scale-[0.97]"
                        variant="outline"
                        size="sm"
                      >
                        <X className="mr-1 h-3 w-3" strokeWidth={1.5} /> Dismiss
                      </Button>
                      <Button
                        disabled={isPending}
                        onClick={() => startTransition(async () => { await approveOpportunity(opp.id); })}
                        className="flex-1 h-8 bg-emerald-500/[0.08] ring-1 ring-emerald-500/15 hover:bg-emerald-500 hover:text-[#0c0c0e] text-emerald-400 text-xs font-medium transition-all duration-200 active:scale-[0.97]"
                        variant="outline"
                        size="sm"
                      >
                        <Check className="mr-1 h-3 w-3" strokeWidth={1.5} /> Approve
                      </Button>
                    </div>
                  </motion.div>
                ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
