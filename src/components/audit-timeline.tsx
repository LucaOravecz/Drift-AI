"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Shield, Zap, User, ArrowRight, Info, AlertOctagon } from "lucide-react";
import { motion } from "framer-motion";

interface AuditLog {
  id: string;
  action: string;
  target: string;
  timestamp: Date;
  severity: string;
  aiInvolved: boolean;
  metadata?: string | null;
  user?: { name: string; role: string } | null;
}

export function AuditTimeline({ logs }: { logs: AuditLog[] }) {
  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return 'text-red-400 border-red-500/30 bg-red-500/10';
      case 'WARNING': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      default: return 'text-zinc-500 border-zinc-700 bg-zinc-800/50';
    }
  };

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return <AlertOctagon className="h-3 w-3" />;
      case 'WARNING': return <Info className="h-3 w-3" />;
      default: return <History className="h-3 w-3" />;
    }
  };

  return (
    <Card className="bg-white/[0.02] border-white/5 shadow-2xl overflow-hidden">
      <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-white/5 bg-white/[0.01]">
        <div>
          <CardTitle className="text-sm font-medium text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-500" />
            Institutional Audit Ledger
          </CardTitle>
          <p className="text-[10px] text-zinc-600 mt-1 uppercase tracking-tighter">
            Immutable Forensic Trail (SOC 2 Compliant)
          </p>
        </div>
        <History className="h-4 w-4 text-zinc-600" />
      </CardHeader>
      <CardContent className="pt-6 relative">
        <div className="absolute left-8 top-0 bottom-0 w-px bg-white/5" />
        
        <div className="space-y-8">
          {logs.length === 0 && (
            <div className="text-center py-10 opacity-30 text-zinc-500 text-sm italic">
              No audit events recorded for this context.
            </div>
          )}
          
          {logs.map((log, index) => (
            <motion.div 
              key={log.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative pl-12"
            >
              {/* Timeline Marker */}
              <div className={`absolute left-[29px] top-1 h-2 w-2 rounded-full border-2 border-[#09090b] z-10
                ${log.severity === 'CRITICAL' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 
                  log.aiInvolved ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-600'}`} 
              />
              
              <div className="flex flex-col gap-2 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-600">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <Badge variant="outline" className={`text-[10px] h-4 font-bold border-none uppercase ${getSeverityColor(log.severity)}`}>
                      {log.severity}
                    </Badge>
                    {log.aiInvolved && (
                      <Badge variant="outline" className="text-[10px] h-4 font-bold bg-emerald-500/10 text-emerald-500 border-none uppercase flex items-center gap-1">
                        <Zap className="h-2 w-2" /> AI Co-pilot
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3 group-hover:bg-white/[0.05] transition-all group-hover:border-white/10 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white/90">
                        {log.action.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                        Target: <span className="text-zinc-400 font-mono text-[10px]">{log.target}</span>
                      </div>
                    </div>
                    {log.user && (
                      <div className="text-right shrink-0">
                        <div className="text-[10px] font-bold text-zinc-400 flex items-center justify-end gap-1">
                          <User className="h-2.5 w-2.5" /> {log.user.name}
                        </div>
                        <div className="text-[10px] text-zinc-600 uppercase tracking-tighter mt-0.5">
                          {log.user.role}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {log.metadata && (
                    <div className="mt-2 pt-2 border-t border-white/[0.05]">
                      <div className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
                        Forensic Evidence Trace
                      </div>
                      <pre className="text-[10px] text-emerald-500/80 font-mono bg-black/40 p-2 rounded overflow-x-hidden line-clamp-2 italic">
                        {log.metadata}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
