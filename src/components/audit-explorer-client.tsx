"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, AlertTriangle, AlertOctagon, Info, Bot, User,
  Search, Filter, ChevronDown, ChevronRight, Clock, Hash, Copy, CheckCheck
} from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  target: string;
  details: string;
  severity: string;
  aiInvolved: boolean;
  beforeState: string | null;
  afterState: string | null;
  metadata: string | null;
  timestamp: Date;
  user: { name: string | null; email: string } | null;
}

interface Stats {
  total: number;
  critical: number;
  warning: number;
  aiInvolved: number;
}

const severityConfig: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  CRITICAL: { icon: AlertOctagon, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  WARNING:  { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  INFO:     { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
};

function formatTime(date: Date) {
  return new Date(date).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

function TraceHash({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const hash = id.substring(0, 12).toUpperCase();
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(id); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
    >
      <Hash className="h-3 w-3" />
      {hash}
      {copied ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100" />}
    </button>
  );
}

function ReasoningReplay({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);

  let metadata: any = null;
  let afterState: any = null;
  try { metadata = log.metadata ? JSON.parse(log.metadata) : null; } catch {}
  try { afterState = log.afterState ? JSON.parse(log.afterState) : null; } catch {}

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Reasoning Replay
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-lg border border-white/5 bg-black/40 p-3 space-y-2 font-mono text-xs text-zinc-400">
              {metadata && (
                <div>
                  <p className="text-zinc-500 mb-1">{"// Trace Metadata"}</p>
                  <pre className="whitespace-pre-wrap text-zinc-300">{JSON.stringify(metadata, null, 2)}</pre>
                </div>
              )}
              {afterState && (
                <div>
                  <p className="text-zinc-500 mb-1">{"// State After Action"}</p>
                  <pre className="whitespace-pre-wrap text-zinc-300">{JSON.stringify(afterState, null, 2)}</pre>
                </div>
              )}
              {!metadata && !afterState && (
                <p className="text-zinc-600">No structured reasoning trace available for this event.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LogRow({ log }: { log: AuditLog }) {
  const cfg = severityConfig[log.severity] ?? severityConfig.INFO;
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group rounded-xl border ${cfg.border} ${cfg.bg} p-4 hover:bg-white/[0.03] transition-all`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex-shrink-0 rounded-md border ${cfg.border} ${cfg.bg} p-1.5`}>
          <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>
                {log.severity}
              </span>
              {log.aiInvolved && (
                <span className="flex items-center gap-1 text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5">
                  <Bot className="h-2.5 w-2.5" /> AI
                </span>
              )}
              <TraceHash id={log.id} />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Clock className="h-3 w-3" />
              {formatTime(log.timestamp)}
            </div>
          </div>

          <p className="mt-1 text-sm font-semibold text-zinc-100 font-mono tracking-tight">
            {log.action}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            <span className="text-zinc-500">Target:</span> {log.target}
          </p>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{log.details}</p>

          <div className="flex items-center gap-3 mt-2">
            {log.user ? (
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <User className="h-3 w-3" />
                {log.user.name ?? log.user.email}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-zinc-600">
                <Bot className="h-3 w-3" /> System Process
              </span>
            )}
          </div>

          <ReasoningReplay log={log} />
        </div>
      </div>
    </motion.div>
  );
}

export function AuditExplorerClient({ logs, stats }: { logs: AuditLog[]; stats: Stats }) {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [aiFilter, setAiFilter] = useState(false);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (severityFilter !== "ALL" && l.severity !== severityFilter) return false;
      if (aiFilter && !l.aiInvolved) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          l.action.toLowerCase().includes(q) ||
          l.target.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, search, severityFilter, aiFilter]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Audit Ledger Explorer</h1>
            <p className="text-xs text-zinc-500">SIEM-grade event log with AI reasoning replay</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          {[
            { label: "Total Events", value: stats.total, color: "text-zinc-300" },
            { label: "Critical", value: stats.critical, color: "text-red-400" },
            { label: "Warning", value: stats.warning, color: "text-amber-400" },
            { label: "AI-Involved", value: stats.aiInvolved, color: "text-violet-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <p className="text-xs text-zinc-500">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            id="audit-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, target, details..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>
        <div className="flex gap-2">
          {["ALL", "CRITICAL", "WARNING", "INFO"].map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                severityFilter === s
                  ? "bg-zinc-700 border-zinc-600 text-zinc-100"
                  : "bg-white/[0.02] border-white/10 text-zinc-500 hover:border-zinc-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => setAiFilter(!aiFilter)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
            aiFilter
              ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
              : "bg-white/[0.02] border-white/10 text-zinc-500 hover:border-zinc-700"
          }`}
        >
          <Bot className="h-3.5 w-3.5" />
          AI Events Only
        </button>
      </div>

      <p className="text-xs text-zinc-600 mb-3">{filtered.length} events</p>

      {/* Log Stream */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-zinc-500 text-sm">
              No audit events match your current filters.
            </div>
          ) : (
            filtered.map((log) => <LogRow key={log.id} log={log} />)
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
