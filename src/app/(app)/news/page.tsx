"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Newspaper, AlertTriangle, TrendingDown, FileText, Building2, Users, ChevronRight, RefreshCw, Loader2 } from "lucide-react";

const categoryConfig: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  RATE_CHANGE:       { icon: TrendingDown, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  SECTOR_VOLATILITY: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  TAX_LAW:           { icon: FileText, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  GEOPOLITICAL:      { icon: Building2, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  EARNINGS:          { icon: TrendingDown, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
};

const severityColor: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/30",
  HIGH: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  MEDIUM: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  LOW: "text-zinc-400 bg-zinc-800 border-zinc-700",
};

const urgencyColor: Record<string, string> = {
  IMMEDIATE_ACTION: "text-red-400 border-red-500/30 bg-red-500/10",
  REVIEW: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  MONITOR: "text-zinc-400 border-zinc-700 bg-zinc-800",
};

export default function NewsOraclePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/news");
      setData(await res.json());
    } catch { } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="mb-8 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Newspaper className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Institutional News Oracle</h1>
            <p className="text-xs text-zinc-500">Macro signals correlated to your book of business</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.02] text-xs text-zinc-400 hover:border-zinc-600 transition-all disabled:opacity-50">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {loading ? "Analyzing..." : "Refresh Oracle"}
        </button>
      </div>

      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          <p className="text-zinc-500 text-sm">Running cross-correlation analysis across your book of business...</p>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {data.events?.length === 0 && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-zinc-500 text-sm">
              No clients with significant macro exposure detected for current signals.
            </div>
          )}
          {data.events?.map((event: any) => {
            const cfg = categoryConfig[event.category] ?? categoryConfig.RATE_CHANGE;
            const Icon = cfg.icon;
            const isExpanded = expanded === event.id;
            return (
              <motion.div key={event.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
                <button onClick={() => setExpanded(isExpanded ? null : event.id)} className="w-full text-left p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg border ${cfg.border} ${cfg.bg}`}>
                        <Icon className={`h-4 w-4 ${cfg.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-zinc-100">{event.title}</p>
                          <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${severityColor[event.severity]}`}>
                            {event.severity}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">{event.summary}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-zinc-500">
                        <Users className="h-3.5 w-3.5" />
                        {event.affectedClients?.length} client{event.affectedClients?.length !== 1 ? "s" : ""}
                      </div>
                      <ChevronRight className={`h-4 w-4 text-zinc-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-white/5">
                      <div className="p-5 space-y-3">
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Affected Clients</p>
                        {event.affectedClients?.map((client: any) => (
                          <div key={client.clientId} className="rounded-lg border border-white/5 bg-black/30 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-semibold text-zinc-100">{client.clientName}</p>
                                  <span className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${urgencyColor[client.urgency]}`}>
                                    {client.urgency.replace(/_/g, " ")}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-400">{client.exposureRationale}</p>
                              </div>
                              <p className="text-xs text-zinc-500 flex-shrink-0">${(client.aum / 1_000_000).toFixed(1)}M AUM</p>
                            </div>
                            <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                              <p className="text-[10px] text-amber-400 uppercase tracking-wide font-semibold mb-1">Recommended Play</p>
                              <p className="text-xs text-zinc-300">{client.recommendedPlay}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
