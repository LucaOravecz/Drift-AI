"use client";

import { useState, useTransition, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Bot, Play, Pause, RefreshCw, Eye, ChevronRight, X, Check, AlertTriangle,
  Clock, Activity, Zap, Users, Landmark, Briefcase, LineChart, FileText,
  ShieldCheck, Network, Heart, Loader2, CheckCircle2, XCircle, Info,
  BarChart3, ListTodo, ArrowUpRight,
} from "lucide-react";
import { runAgent, pauseAgent, resumeAgent, approveAgentOutput, dismissAgentOutput } from "@/lib/actions";
import type { AgentDefinition, AgentOutput, AgentTask } from "@prisma/client";
import type { AgentStatus } from "@/lib/services/agent.service";

// --------------------------------------------------
// Types
// --------------------------------------------------

interface AgentCommandCenterProps {
  agents: AgentDefinition[];
  workload: {
    totalAgents: number;
    running: number;
    idle: number;
    paused: number;
    errors: number;
    reviewNeeded: number;
    totalOutputsToday: number;
    totalPendingReviews: number;
    totalQueueItems: number;
  };
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const ICON_MAP: Record<string, React.ElementType> = {
  Zap, Users, Landmark, Briefcase, LineChart, FileText, ShieldCheck, Network, Heart,
};

const STATUS_CONFIG: Record<AgentStatus, { label: string; badge: string; dot: string }> = {
  RUNNING:       { label: "Running",       badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",  dot: "bg-emerald-400 animate-pulse" },
  IDLE:          { label: "Idle",          badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",           dot: "bg-zinc-500" },
  PAUSED:        { label: "Paused",        badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",        dot: "bg-amber-400" },
  ERROR:         { label: "Error",         badge: "bg-red-500/15 text-red-400 border-red-500/30",              dot: "bg-red-400 animate-pulse" },
  REVIEW_NEEDED: { label: "Review Needed", badge: "bg-purple-500/15 text-purple-400 border-purple-500/30",     dot: "bg-purple-400 animate-pulse" },
};

const OUTPUT_TYPE_COLORS: Record<string, string> = {
  BRIEF:          "text-purple-400",
  INSIGHT:        "text-blue-400",
  DRAFT:          "text-amber-400",
  ALERT:          "text-red-400",
  REPORT:         "text-emerald-400",
  RECOMMENDATION: "text-cyan-400",
};

const REVIEW_BADGE: Record<string, string> = {
  PENDING:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  DISMISSED:"bg-zinc-500/10 text-zinc-500 border-zinc-700",
};

function timeAgo(date: Date): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVar: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 380, damping: 28 } },
};

// --------------------------------------------------
// Agent Detail Drawer
// --------------------------------------------------

function AgentDrawer({
  agent,
  onClose,
  onAction,
}: {
  agent: AgentDefinition;
  onClose: () => void;
  onAction: (type: "run" | "pause" | "resume" | "approve" | "dismiss", id: string) => void;
}) {
  const sc = STATUS_CONFIG[agent.status];
  const Icon = ICON_MAP[agent.icon] ?? Bot;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      className="fixed right-0 top-0 h-full w-[480px] bg-zinc-950 border-l border-white/5 z-50 overflow-y-auto shadow-2xl"
    >
      {/* Header */}
      <div className="sticky top-0 bg-zinc-950/95 backdrop-blur border-b border-white/5 p-5 flex items-start gap-3">
        <div className={`h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0`}>
          <Icon className={`h-5 w-5 ${agent.colorClass}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-base">{agent.name}</h2>
            <Badge className={`text-[10px] border ${sc.badge}`}>{sc.label}</Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{agent.purpose}</p>
        </div>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Success Rate", value: `${agent.successRate}%`, icon: BarChart3, color: "text-emerald-400" },
            { label: "Confidence", value: `${agent.confidenceLevel}%`, icon: Activity, color: "text-blue-400" },
            { label: "Outputs Today", value: agent.outputsToday, icon: Zap, color: "text-amber-400" },
            { label: "Queue Items", value: agent.taskQueueCount, icon: ListTodo, color: "text-purple-400" },
            { label: "Pending Reviews", value: agent.pendingReviews, icon: Eye, color: "text-rose-400" },
            { label: "Last Run", value: timeAgo(agent.lastRun), icon: Clock, color: "text-zinc-400" },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
              <s.icon className={`h-4 w-4 ${s.color} mb-1`} />
              <p className="text-sm font-semibold">{s.value}</p>
              <p className="text-[10px] text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Current task */}
        {agent.currentTask && (
          <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
            <div className="flex items-center gap-2 mb-1">
              <Loader2 className="h-3.5 w-3.5 text-emerald-400 animate-spin" />
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400">In Progress</span>
            </div>
            <p className="text-xs text-zinc-300">{agent.currentTask}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {agent.status !== "RUNNING" && agent.status !== "PAUSED" && (
            <Button size="sm" variant="outline" className="gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => onAction("run", agent.id)}>
              <Play className="h-3.5 w-3.5" /> Run Now
            </Button>
          )}
          {agent.status === "RUNNING" && (
            <Button size="sm" variant="outline" className="gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => onAction("pause", agent.id)}>
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
          )}
          {agent.status === "PAUSED" && (
            <Button size="sm" variant="outline" className="gap-1.5 border-blue-500/30 text-blue-400 hover:bg-blue-500/10" onClick={() => onAction("resume", agent.id)}>
              <Play className="h-3.5 w-3.5" /> Resume
            </Button>
          )}
        </div>

        {/* Recent Tasks Timeline */}
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-3">Task Timeline</h3>
          <div className="relative space-y-3">
            {agent.recentTasks.map((task, idx) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex gap-3"
              >
                {/* Timeline connector */}
                <div className="flex flex-col items-center">
                  {/* Timeline dot */}
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 border-2 ${
                    task.status === "COMPLETED" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                    : task.status === "IN_PROGRESS" ? "bg-blue-500/20 border-blue-500 text-blue-400"
                    : task.status === "FAILED" ? "bg-red-500/20 border-red-500 text-red-400"
                    : "bg-zinc-500/20 border-zinc-600 text-zinc-500"
                  }`}>
                    {task.status === "COMPLETED" && <CheckCircle2 className="h-3 w-3" />}
                    {task.status === "IN_PROGRESS" && <Loader2 className="h-3 w-3 animate-spin" />}
                    {task.status === "FAILED" && <XCircle className="h-3 w-3" />}
                    {!["COMPLETED", "IN_PROGRESS", "FAILED"].includes(task.status) && <Clock className="h-3 w-3" />}
                  </div>
                  {/* Connector line */}
                  {idx < agent.recentTasks.length - 1 && (
                    <div className="w-0.5 h-8 bg-gradient-to-b from-white/10 to-transparent mt-1" />
                  )}
                </div>

                {/* Content */}
                <div className="pt-0.5 pb-3 flex-1">
                  <p className="text-xs text-zinc-300 font-medium leading-relaxed">{task.description}</p>
                  {task.output && <p className="text-xs text-zinc-500 mt-1">{task.output}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      task.status === "COMPLETED" ? "bg-emerald-500/15 text-emerald-400"
                      : task.status === "IN_PROGRESS" ? "bg-blue-500/15 text-blue-400"
                      : task.status === "FAILED" ? "bg-red-500/15 text-red-400"
                      : "bg-zinc-500/15 text-zinc-500"
                    }`}>{task.status}</span>
                    <span className="text-[10px] text-zinc-600">{timeAgo(task.startedAt)}</span>
                    {task.linkedClient && (
                      <>
                        <span className="text-zinc-700">·</span>
                        <span className="text-[10px] text-zinc-500">{task.linkedClient}</span>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Outputs */}
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-3">Outputs</h3>
          <div className="space-y-2">
            {agent.outputs.map((out) => (
              <div key={out.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className={`text-[10px] font-mono ${OUTPUT_TYPE_COLORS[out.type] ?? "text-zinc-400"}`}>{out.type}</span>
                  <Badge className={`text-[10px] border ${REVIEW_BADGE[out.reviewStatus]}`}>{out.reviewStatus}</Badge>
                </div>
                <p className="text-xs font-medium text-white/80 mb-0.5">{out.title}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{out.summary}</p>
                {out.reviewStatus === "PENDING" && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => onAction("approve", out.id)}>
                      <Check className="h-3 w-3" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1 border-zinc-700 text-zinc-500 hover:bg-zinc-800" onClick={() => onAction("dismiss", out.id)}>
                      <X className="h-3 w-3" /> Dismiss
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --------------------------------------------------
// Agent Card
// --------------------------------------------------

function AgentCard({
  agent,
  onSelect,
  onAction,
  actionLoading,
}: {
  agent: AgentDefinition;
  onSelect: () => void;
  onAction: (type: "run" | "pause" | "resume", id: string) => void;
  actionLoading: string | null;
}) {
  const sc = STATUS_CONFIG[agent.status];
  const Icon = ICON_MAP[agent.icon] ?? Bot;
  const isLoading = actionLoading === agent.id;

  return (
    <motion.div variants={itemVar}>
      <Card className="bg-zinc-900/50 border-white/5 hover:border-white/10 transition-all group">
        <CardContent className="p-4">
          {/* Top row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <Icon className={`h-4 w-4 ${agent.colorClass}`} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{agent.name}</p>
                {agent.linkedRecord && (
                  <p className="text-[10px] text-zinc-600 mt-0.5">{agent.linkedRecord}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${sc.dot} shrink-0`} />
              <Badge className={`text-[10px] border ${sc.badge}`}>{sc.label}</Badge>
            </div>
          </div>

          {/* Current task */}
          {agent.currentTask ? (
            <div className="mb-3 p-2 rounded-md bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 text-blue-400 animate-spin shrink-0" />
                <p className="text-[11px] text-zinc-400 leading-snug">{agent.currentTask}</p>
              </div>
            </div>
          ) : (
            <div className="mb-3 h-[40px] flex items-center">
              <p className="text-[11px] text-zinc-600 italic">No active task</p>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-1 mb-3">
            {[
              { label: "Success", value: `${agent.successRate}%`, color: "text-emerald-400" },
              { label: "Queue", value: agent.taskQueueCount, color: "text-blue-400" },
              { label: "Outputs", value: agent.outputsToday, color: "text-amber-400" },
              { label: "Reviews", value: agent.pendingReviews, color: agent.pendingReviews > 0 ? "text-rose-400" : "text-zinc-600" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-xs font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-zinc-600 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Last run */}
          <div className="flex items-center gap-1.5 mb-3">
            <Clock className="h-3 w-3 text-zinc-600 shrink-0" />
            <span className="text-[10px] text-zinc-600">Last run: {timeAgo(agent.lastRun)}</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-1.5">
            {agent.status !== "RUNNING" && agent.status !== "PAUSED" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] flex-1 gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                disabled={isLoading}
                onClick={() => onAction("run", agent.id)}
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Run
              </Button>
            )}
            {agent.status === "RUNNING" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] flex-1 gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                disabled={isLoading}
                onClick={() => onAction("pause", agent.id)}
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pause className="h-3 w-3" />}
                Pause
              </Button>
            )}
            {agent.status === "PAUSED" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] flex-1 gap-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                disabled={isLoading}
                onClick={() => onAction("resume", agent.id)}
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Resume
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] gap-1 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5"
              onClick={onSelect}
            >
              <Eye className="h-3 w-3" /> Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// --------------------------------------------------
// Activity Feed
// --------------------------------------------------

interface FeedEvent {
  id: string;
  agentName: string;
  agentColor: string;
  action: string;
  detail: string;
  time: Date;
  type: "success" | "info" | "warning" | "error";
}

function buildFeed(agents: AgentDefinition[]): FeedEvent[] {
  const events: FeedEvent[] = [];
  for (const agent of agents) {
    for (const task of agent.recentTasks.slice(0, 2)) {
      events.push({
        id: `${agent.id}-${task.id}`,
        agentName: agent.name,
        agentColor: agent.colorClass,
        action: task.status === "COMPLETED" ? "Completed task" : task.status === "IN_PROGRESS" ? "Started task" : "Failed task",
        detail: task.description,
        time: task.completedAt ?? task.startedAt,
        type: task.status === "COMPLETED" ? "success" : task.status === "IN_PROGRESS" ? "info" : "error",
      });
    }
  }
  return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 15);
}

const feedTypeIcon: Record<string, React.ElementType> = {
  success: CheckCircle2,
  info: Activity,
  warning: AlertTriangle,
  error: XCircle,
};
const feedTypeColor: Record<string, string> = {
  success: "text-emerald-400",
  info: "text-blue-400",
  warning: "text-amber-400",
  error: "text-red-400",
};

// --------------------------------------------------
// Main Component
// --------------------------------------------------

export function AgentCommandCenterClient({ agents: initialAgents, workload: initialWorkload }: AgentCommandCenterProps) {
  const [agents, setAgents] = useState<AgentDefinition[]>(initialAgents);
  const [workload, setWorkload] = useState(initialWorkload);
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Refresh agents from server every 8 seconds (simulates live state)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/agents", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents);
          setWorkload(data.workload);
          // Keep drawer in sync
          if (selectedAgent) {
            const updated = data.agents.find((a: AgentDefinition) => a.id === selectedAgent.id);
            if (updated) setSelectedAgent(updated);
          }
        }
      } catch {
        // silent — demo mode
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedAgent]);

  const handleAction = async (type: "run" | "pause" | "resume" | "approve" | "dismiss", id: string) => {
    setActionLoading(id);
    startTransition(async () => {
      try {
        let result: { success: boolean; message?: string };
        if (type === "run") result = await runAgent(id);
        else if (type === "pause") result = await pauseAgent(id);
        else if (type === "resume") result = await resumeAgent(id);
        else if (type === "approve") result = await approveAgentOutput(id);
        else result = await dismissAgentOutput(id);

        if (result.success) {
          toast.success(result.message ?? "Action completed");
          // Optimistically update local state
          const res = await fetch("/api/agents", { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            setAgents(data.agents);
            setWorkload(data.workload);
            if (selectedAgent) {
              const updated = data.agents.find((a: AgentDefinition) => a.id === selectedAgent.id);
              if (updated) setSelectedAgent(updated);
            }
          }
        } else {
          toast.error(result.message ?? "Action failed");
        }
      } catch {
        toast.error("Action failed");
      } finally {
        setActionLoading(null);
      }
    });
  };

  const feed = buildFeed(agents);

  return (
    <>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-8 max-w-7xl">
        {/* Header */}
        <motion.div variants={itemVar} className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Bot className="h-5 w-5 text-indigo-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Agent Command Center</h1>
            <p className="text-sm text-muted-foreground">Your AI workforce — monitor, control, and review every agent</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono text-emerald-400">{workload.running} ACTIVE</span>
            </div>
            {workload.reviewNeeded > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                <AlertTriangle className="h-3 w-3 text-purple-400" />
                <span className="text-xs font-mono text-purple-400">{workload.reviewNeeded} REVIEW</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Workload summary */}
        <motion.div variants={itemVar} className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: "Total Agents", value: workload.totalAgents, icon: Bot, color: "text-zinc-400" },
            { label: "Running", value: workload.running, icon: Activity, color: "text-emerald-400" },
            { label: "Idle", value: workload.idle, icon: Clock, color: "text-zinc-400" },
            { label: "Paused", value: workload.paused, icon: Pause, color: "text-amber-400" },
            { label: "Outputs Today", value: workload.totalOutputsToday, icon: Zap, color: "text-blue-400" },
            { label: "Pending Reviews", value: workload.totalPendingReviews, icon: Eye, color: workload.totalPendingReviews > 0 ? "text-rose-400" : "text-zinc-600" },
          ].map((s) => (
            <Card key={s.label} className="bg-card">
              <CardContent className="p-3 flex items-center gap-2">
                <s.icon className={`h-6 w-6 ${s.color} shrink-0`} />
                <div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-zinc-600">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Agents grid */}
        <motion.div variants={itemVar}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Agent Roster</h2>
            <span className="text-xs text-zinc-600">{agents.length} agents deployed</span>
          </div>
          <motion.div variants={container} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onSelect={() => setSelectedAgent(agent)}
                onAction={handleAction}
                actionLoading={actionLoading}
              />
            ))}
          </motion.div>
        </motion.div>

        {/* Activity Feed + Alerts */}
        <motion.div variants={itemVar} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activity feed */}
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-400" /> Agent Activity Feed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {feed.map((event) => {
                const Icon = feedTypeIcon[event.type];
                return (
                  <div key={event.id} className="flex items-start gap-2.5 py-2 border-b border-white/[0.03] last:border-0">
                    <Icon className={`h-3.5 w-3.5 ${feedTypeColor[event.type]} shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-semibold ${event.agentColor}`}>{event.agentName}</span>
                        <span className="text-zinc-700 text-[10px]">·</span>
                        <span className="text-[10px] text-zinc-600">{event.action}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-snug truncate">{event.detail}</p>
                    </div>
                    <span className="text-[10px] text-zinc-700 shrink-0">{timeAgo(event.time)}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Alerts & Exceptions */}
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" /> Alerts & Exceptions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agents.filter((a) => a.status === "REVIEW_NEEDED" || a.pendingReviews > 0 || a.status === "ERROR").map((agent) => {
                const Icon = ICON_MAP[agent.icon] ?? Bot;
                return (
                  <div
                    key={agent.id}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer hover:border-white/10 transition-colors"
                    onClick={() => setSelectedAgent(agent)}
                  >
                    <Icon className={`h-4 w-4 ${agent.colorClass} shrink-0`} />
                    <div className="flex-1">
                      <p className="text-xs font-medium">{agent.name}</p>
                      {agent.status === "REVIEW_NEEDED" && (
                        <p className="text-[10px] text-purple-400">Requires advisor review</p>
                      )}
                      {agent.pendingReviews > 0 && (
                        <p className="text-[10px] text-amber-400">{agent.pendingReviews} output{agent.pendingReviews > 1 ? "s" : ""} pending approval</p>
                      )}
                      {agent.status === "ERROR" && (
                        <p className="text-[10px] text-red-400">Agent error — intervention needed</p>
                      )}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                  </div>
                );
              })}
              {agents.every((a) => a.status !== "REVIEW_NEEDED" && a.pendingReviews === 0 && a.status !== "ERROR") && (
                <div className="flex items-center gap-2 py-4 text-zinc-600">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs">No active alerts — all agents operating normally</span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Performance Analytics */}
        <motion.div variants={itemVar}>
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-400" /> Agent Performance Overview
              </CardTitle>
              <CardDescription>Success rates and confidence levels across the workforce</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Summary metrics */}
                <div className="grid grid-cols-3 gap-3 pb-4 border-b border-white/5">
                  <div>
                    <p className="text-[10px] font-mono uppercase text-zinc-500">Avg Success</p>
                    <p className="text-lg font-semibold text-emerald-400 mt-1">{Math.round(agents.reduce((s, a) => s + a.successRate, 0) / Math.max(agents.length, 1))}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase text-zinc-500">Avg Confidence</p>
                    <p className="text-lg font-semibold text-blue-400 mt-1">{Math.round(agents.reduce((s, a) => s + a.confidenceLevel, 0) / Math.max(agents.length, 1))}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase text-zinc-500">Quality Score</p>
                    <p className="text-lg font-semibold text-purple-400 mt-1">94%</p>
                  </div>
                </div>

                {/* Per-agent bars */}
                <div className="space-y-3">
                  {agents.map((agent) => {
                    const Icon = ICON_MAP[agent.icon] ?? Bot;
                    return (
                      <div key={agent.id} className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 ${agent.colorClass} shrink-0`} />
                        <span className="text-xs text-zinc-400 w-40 truncate shrink-0">{agent.name}</span>

                        {/* Success Rate */}
                        <div className="flex items-center gap-1.5 flex-1">
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${agent.successRate}%` }}
                              transition={{ duration: 1, delay: 0.3 }}
                              className="h-full bg-emerald-500/60 rounded-full"
                            />
                          </div>
                          <span className="text-xs font-mono text-emerald-400 w-8 text-right">{agent.successRate}%</span>
                        </div>

                        {/* Confidence */}
                        <div className="flex items-center gap-1.5 flex-1">
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${agent.confidenceLevel}%` }}
                              transition={{ duration: 1, delay: 0.4 }}
                              className="h-full bg-blue-500/60 rounded-full"
                            />
                          </div>
                          <span className="text-xs font-mono text-blue-400 w-8 text-right">{agent.confidenceLevel}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex justify-end gap-6 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-4 rounded-full bg-emerald-500/60" />
                    <span className="text-[10px] text-zinc-500">Success</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-4 rounded-full bg-blue-500/60" />
                    <span className="text-[10px] text-zinc-500">Confidence</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Agent Detail Drawer */}
      <AnimatePresence>
        {selectedAgent && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => setSelectedAgent(null)}
            />
            <AgentDrawer
              agent={selectedAgent}
              onClose={() => setSelectedAgent(null)}
              onAction={handleAction}
            />
          </>
        )}
      </AnimatePresence>
    </>
  );
}
