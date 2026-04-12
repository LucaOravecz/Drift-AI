"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ShieldCheck, Search, AlertTriangle, CheckCircle2, 
  Loader2, X, Bot, Inbox, CheckSquare, 
  Square, ChevronRight, Scale
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { bulkProcessComplianceItems } from "@/lib/actions";
import { toast } from "sonner";
import { ExplainableFindingPanel } from "@/components/explainable-finding-panel";
import type { ExplainableFinding } from "@/lib/findings";

const sourceColors: Record<string, string> = {
  COMMUNICATION: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  TAX: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  OPPORTUNITY: "text-primary bg-primary/10 border-primary/20",
  INVESTMENT: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  FLAG: "text-red-400 bg-red-500/10 border-red-500/20",
  RESEARCH: "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

const severityColors: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/30",
  HIGH: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  LOW: "text-zinc-400 bg-zinc-800 border-zinc-700",
};

type ReviewSource = "COMMUNICATION" | "TAX" | "OPPORTUNITY" | "INVESTMENT" | "FLAG" | "RESEARCH";
type ReviewSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface ReviewQueueItem {
  id: string;
  source: ReviewSource;
  type: string | null;
  severity: ReviewSeverity;
  title: string;
  description: string;
  clientName: string;
  createdAt: string | Date;
  aiInvolved: boolean;
  status: string;
  metadata: {
    body?: string;
    impact?: string | null;
    value?: number | null;
    reasoning?: string | null;
    finding?: ExplainableFinding | null;
    risks?: string | null;
    catalysts?: string | null;
  };
}

interface ComplianceStats {
  openFlags: number;
  criticalFlags: number;
  totalLogs: number;
  aiLogs: number;
}

interface AuditLogItem {
  id: string;
  timestamp: string | Date;
  action: string;
  target: string;
  details: string | null;
  aiInvolved: boolean;
  user?: {
    name: string | null;
  } | null;
}

export function ComplianceClient({ 
  logs, 
  stats, 
  reviewQueue 
}: { 
  logs: AuditLogItem[]; 
  stats: ComplianceStats;
  reviewQueue: ReviewQueueItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("inbox");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [localReviewQueue, setLocalReviewQueue] = useState(reviewQueue);
  const [peekItem, setPeekItem] = useState<ReviewQueueItem | null>(null);
  const [search, setSearch] = useState("");

  const handleBulkAction = (action: "APPROVE" | "REJECT" | "RESOLVE") => {
    if (selectedIds.length === 0) return;

    startTransition(async () => {
      try {
        const itemsToProcess = localReviewQueue
          .filter(item => selectedIds.includes(item.id))
          .map(item => ({ id: item.id, source: item.source }));

        await bulkProcessComplianceItems(itemsToProcess, action);
        
        toast.success(`Bulk ${action.toLowerCase()} complete`, {
          description: `Processed ${selectedIds.length} items. Records updated and logged.`
        });

        setLocalReviewQueue(prev => prev.filter(item => !selectedIds.includes(item.id)));
        setSelectedIds([]);
        setPeekItem(null);
      } catch {
        toast.error("Bulk processing failed");
      }
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredInbox.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredInbox.map(i => i.id));
    }
  };

  const filteredInbox = localReviewQueue.filter(item => 
    !search || 
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    item.clientName.toLowerCase().includes(search.toLowerCase()) ||
    item.source.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 pb-20 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white/90">Compliance Command Center</h1>
          <p className="text-zinc-400 mt-1 flex items-center gap-2">
            <Scale className="h-4 w-4" /> Unified review for all institutional AI outputs and high-value strategies.
          </p>
        </div>
        <div className="flex gap-3">
            <Card className="bg-primary/5 border-primary/20 py-2 px-4 h-fit flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
                <span className="text-xs font-medium text-primary uppercase tracking-widest">Live Governance Active</span>
            </Card>
        </div>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Pending Reviews", value: localReviewQueue.length, icon: Inbox, color: "text-primary" },
          { label: "Critical Risks", value: stats.criticalFlags, icon: AlertTriangle, color: "text-red-400" },
          { label: "AI Governance Interventions", value: stats.aiLogs, icon: Bot, color: "text-blue-400" },
          { label: "Open Flags", value: stats.openFlags, icon: CheckCircle2, color: "text-emerald-400" },
        ].map((s) => (
          <Card key={s.label} className="bg-white/[0.02] border-white/5 overflow-hidden group hover:border-primary/20 transition-all">
            <CardContent className="pt-6 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className={`text-2xl font-bold mb-1 ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-tighter font-semibold">{s.label}</div>
                </div>
                <s.icon className={`h-5 w-5 ${s.color} opacity-20 group-hover:opacity-60 transition-opacity`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="inbox" className="w-full" onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-4 mb-4">
            <TabsList className="bg-white/5 border border-white/10 p-1">
                <TabsTrigger value="inbox" className="data-[state=active]:bg-white/10 text-xs px-4">
                    Unified Inbox ({localReviewQueue.length})
                </TabsTrigger>
                <TabsTrigger value="logs" className="data-[state=active]:bg-white/10 text-xs px-4">
                    Audit Ledger
                </TabsTrigger>
            </TabsList>

            {activeTab === "inbox" && (
                <div className="flex items-center gap-3">
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-600" />
                        <Input
                            placeholder="Search inbox..."
                            className="pl-8 h-8 text-xs bg-black/40 border-white/10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <AnimatePresence>
                        {selectedIds.length > 0 && (
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="flex gap-2"
                            >
                                <Button 
                                    size="sm" 
                                    onClick={() => handleBulkAction("APPROVE")}
                                    disabled={isPending}
                                    className="h-8 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                                >
                                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-2" />}
                                    Approve Selected ({selectedIds.length})
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleBulkAction("REJECT")}
                                    disabled={isPending}
                                    className="h-8 border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                                >
                                    Reject
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>

        <TabsContent value="inbox" className="mt-0">
          <div className="flex gap-6">
            <Card className="flex-1 bg-white/[0.02] border-white/5 overflow-hidden">
                <Table>
                    <TableHeader className="bg-white/[0.03]">
                        <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="w-[40px] px-4">
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={toggleSelectAll}>
                                    {selectedIds.length === filteredInbox.length && filteredInbox.length > 0 ? (
                                        <CheckSquare className="h-4 w-4 text-primary" />
                                    ) : (
                                        <Square className="h-4 w-4 text-zinc-600" />
                                    )}
                                </Button>
                            </TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-zinc-500">Source</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-zinc-500">Entity / Client</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-zinc-500">Action Required</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold text-zinc-500 text-right">Age</TableHead>
                            <TableHead className="w-[40px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredInbox.map((item) => (
                            <TableRow 
                                key={item.id} 
                                className={`border-white/5 transition-colors cursor-pointer group ${peekItem?.id === item.id ? "bg-white/5" : "hover:bg-white/[0.02]"}`}
                                onClick={() => setPeekItem(item)}
                            >
                                <TableCell className="px-4" onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}>
                                    {selectedIds.includes(item.id) ? (
                                        <CheckSquare className="h-4 w-4 text-primary" />
                                    ) : (
                                        <Square className="h-4 w-4 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${sourceColors[item.source]}`}>
                                        {item.source}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs font-medium text-white/80">{item.clientName}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <div className="text-xs text-white/90 flex items-center gap-1.5">
                                            {item.severity === "CRITICAL" && <AlertTriangle className="h-3 w-3 text-red-400" />}
                                            {item.title}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">{item.description}</div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-[10px] text-zinc-600 font-mono text-right capitalize">
                                    {new Date(item.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="text-right">
                                    <ChevronRight className={`h-4 w-4 transition-transform ${peekItem?.id === item.id ? "rotate-90 text-primary" : "text-zinc-800 group-hover:text-zinc-600"}`} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {filteredInbox.length === 0 && (
                    <div className="text-center py-24">
                        <ShieldCheck className="h-12 w-12 mx-auto mb-4 text-zinc-800" />
                        <h3 className="text-white/80 font-medium">Compliance Review Cleared</h3>
                        <p className="text-zinc-600 text-xs mt-1">No items currently requiring institutional sign-off.</p>
                    </div>
                )}
            </Card>

            {/* Evidence Peek Panel */}
            <AnimatePresence>
                {peekItem && (
                    <motion.div
                        initial={{ opacity: 0, x: 20, width: 0 }}
                        animate={{ opacity: 1, x: 0, width: 450 }}
                        exit={{ opacity: 0, x: 20, width: 0 }}
                        className="overflow-hidden"
                    >
                        <Card className="h-full bg-white/[0.04] border-white/10 flex flex-col">
                            <CardHeader className="pb-4 border-b border-white/5">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-1">
                                        <Badge className={`w-fit text-[9px] ${severityColors[peekItem.severity]}`}>
                                            {peekItem.severity} RISK
                                        </Badge>
                                        <CardTitle className="text-sm text-white/90">{peekItem.title}</CardTitle>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setPeekItem(null)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto pt-6 space-y-6">
                                <div>
                                    <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Institutional Significance</h4>
                                    <p className="text-sm text-zinc-300 leading-relaxed font-advisor">{peekItem.description}</p>
                                </div>

                                {peekItem.metadata.body && (
                                    <div className="bg-black/40 p-4 border border-white/5 rounded-lg">
                                        <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-3 flex items-center justify-between">
                                            Draft Outreach
                                            <Badge variant="outline" className="text-[8px] border-primary/20 text-primary uppercase">Raw AI Generation</Badge>
                                        </h4>
                                        <div className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed font-advisor">
                                            {peekItem.metadata.body}
                                        </div>
                                    </div>
                                )}

                                {peekItem.metadata.finding ? (
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                                            <Bot className="h-5 w-5 text-primary shrink-0" />
                                            <div className="flex-1">
                                                <h4 className="text-[10px] uppercase font-bold text-primary mb-3">Explainable Finding Trace</h4>
                                                <ExplainableFindingPanel finding={peekItem.metadata.finding} />
                                            </div>
                                        </div>
                                    </div>
                                ) : peekItem.metadata.reasoning ? (
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                                            <Bot className="h-5 w-5 text-primary shrink-0" />
                                            <div>
                                                <h4 className="text-[10px] uppercase font-bold text-primary mb-1">AI Strategic Rationale</h4>
                                                <p className="text-xs text-zinc-400 leading-normal">{peekItem.metadata.reasoning}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                {peekItem.metadata.impact && (
                                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Scale className="h-4 w-4 text-emerald-400" />
                                            <span className="text-[10px] uppercase font-bold text-emerald-400">Projected Value Impact</span>
                                        </div>
                                        <span className="text-xs font-mono text-emerald-400">{peekItem.metadata.impact}</span>
                                    </div>
                                )}
                            </CardContent>
                            <div className="p-4 bg-white/5 border-t border-white/5 flex gap-2">
                                <Button 
                                    className="flex-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 h-9 text-xs"
                                    onClick={() => handleBulkAction("APPROVE")}
                                    disabled={isPending}
                                >
                                    Approve & Commit
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="flex-1 h-9 text-xs border-white/10"
                                    onClick={() => handleBulkAction("REJECT")}
                                    disabled={isPending}
                                >
                                    Reject
                                </Button>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-0">
          <Card className="bg-white/[0.02] border-white/5 overflow-hidden">
            <Table>
                <TableHeader className="bg-white/[0.03]">
                    <TableRow className="border-white/5 hover:bg-transparent">
                        <TableHead className="text-[10px] uppercase font-bold text-zinc-500 pl-4 py-4">Timestamp</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-zinc-500">Actor</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-zinc-500">Action Type</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-zinc-500">Target</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-zinc-500">Details</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-zinc-500 text-right pr-4">AI</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                      <TableCell className="text-[11px] text-zinc-600 font-mono pl-4">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400 font-medium">
                        {log.user?.name ?? "System Engine"}
                      </TableCell>
                      <TableCell className="text-xs uppercase tracking-tight font-bold">
                        {log.action === "SENSITIVE_DATA_ACCESS" ? (
                            <span className="text-amber-400/80">{log.action}</span>
                        ) : log.action === "UNAUTHORIZED_ACCESS_ATTEMPT" ? (
                            <span className="text-red-400 underline decoration-red-400/30 underline-offset-4">{log.action}</span>
                        ) : (
                            <span className="text-zinc-500">{log.action}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500 truncate max-w-[120px]">{log.target}</TableCell>
                      <TableCell className="text-xs text-zinc-500 max-w-[300px]">
                        <span className="line-clamp-1">{log.details}</span>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        {log.aiInvolved && <Bot className="h-3.5 w-3.5 text-primary/60" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
