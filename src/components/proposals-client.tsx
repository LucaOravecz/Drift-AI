"use client";

import { useTransition, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Shield, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Download, FileDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface ProposalSection {
  title: string;
  content: string;
  dataSource: string;
  isAIGenerated: boolean;
  requiresReview: boolean;
}

interface ProposalResult {
  id: string;
  type: string;
  clientId: string;
  clientName: string;
  sections: ProposalSection[];
  complianceScanPassed: boolean;
  complianceHits: number;
  dataQuality: string;
  missingData: string[];
  generatedAt: string;
  status: string;
  version: number;
}

const qualityColors: Record<string, string> = {
  COMPLETE: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  PARTIAL: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  INSUFFICIENT: "text-red-400 border-red-500/30 bg-red-500/10",
};

export function ProposalsClient({ clients }: { clients: Array<{ id: string; name: string; riskProfile: string | null }> }) {
  const [isPending, startTransition] = useTransition();
  const [proposal, setProposal] = useState<ProposalResult | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const generateIPS = (clientId: string) => {
    setSelectedClientId(clientId);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/proposals/ips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId }),
        });
        if (!res.ok) throw new Error("IPS generation failed");
        const data = await res.json();
        setProposal(data.data);
        toast.success("IPS Generated", { description: `Investment Policy Statement for ${data.data.clientName}` });
      } catch {
        toast.error("Generation Failed", { description: "Could not generate IPS." });
      }
    });
  };

  const generateProposal = (clientId: string) => {
    setSelectedClientId(clientId);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/proposals/new-client", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId }),
        });
        if (!res.ok) throw new Error("Proposal generation failed");
        const data = await res.json();
        setProposal(data.data);
        toast.success("Proposal Generated", { description: `New client proposal for ${data.data.clientName}` });
      } catch {
        toast.error("Generation Failed", { description: "Could not generate proposal." });
      }
    });
  };

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const downloadDocument = (format: "docx" | "pdf") => {
    if (!proposal || !selectedClientId) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/proposals/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: selectedClientId, format, type: proposal.type }),
        });
        if (!res.ok) throw new Error("Export failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${proposal.type}_${proposal.clientName.replace(/\s+/g, "_")}_v${proposal.version}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`${format.toUpperCase()} Downloaded`, { description: "Document saved to your downloads folder." });
      } catch {
        toast.error("Export Failed", { description: "Could not generate document file." });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="h-6 w-6 text-purple-400" />
          IPS & Proposal Generator
        </h1>
        <p className="text-zinc-400 text-sm mt-1">AI-grounded investment policy statements and client proposals</p>
      </div>

      {/* Client Selection */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-lg">Select Client</CardTitle>
          <CardDescription className="text-zinc-400">Choose a client to generate an IPS or new client proposal</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {clients.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-zinc-300">{c.name}</span>
                  <Badge variant="outline" className="text-zinc-500">{c.riskProfile ?? "No profile"}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => generateIPS(c.id)} disabled={isPending} className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10">
                    <Shield className="h-3 w-3 mr-1" /> IPS
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => generateProposal(c.id)} disabled={isPending} className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10">
                    <FileText className="h-3 w-3 mr-1" /> Proposal
                  </Button>
                </div>
              </div>
            ))}
            {clients.length === 0 && (
              <p className="text-zinc-500 text-center py-4">No clients found. Add clients first.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generated Proposal */}
      <AnimatePresence>
        {proposal && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      {proposal.type === "IPS" ? <Shield className="h-5 w-5 text-purple-400" /> : <FileText className="h-5 w-5 text-blue-400" />}
                      {proposal.type === "IPS" ? "Investment Policy Statement" : "New Client Proposal"} — {proposal.clientName}
                    </CardTitle>
                    <CardDescription className="text-zinc-400 mt-1">
                      Version {proposal.version} | Generated {new Date(proposal.generatedAt).toLocaleString()}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={qualityColors[proposal.dataQuality]}>{proposal.dataQuality}</Badge>
                    {proposal.complianceScanPassed ? (
                      <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10"><CheckCircle2 className="h-3 w-3 mr-1" />Compliance Clear</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10"><AlertTriangle className="h-3 w-3 mr-1" />{proposal.complianceHits} Flags</Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={() => downloadDocument("docx")} disabled={isPending} className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10">
                      <FileDown className="h-3 w-3 mr-1" /> DOCX
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadDocument("pdf")} disabled={isPending} className="text-red-400 border-red-500/30 hover:bg-red-500/10">
                      <Download className="h-3 w-3 mr-1" /> PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {proposal.missingData.length > 0 && (
                  <div className="mb-4 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                    <p className="text-amber-400 text-sm font-medium">Data Gaps:</p>
                    <ul className="text-zinc-400 text-xs mt-1 space-y-1">
                      {proposal.missingData.map((m, i) => <li key={i}>• {m}</li>)}
                    </ul>
                  </div>
                )}

                <div className="space-y-2">
                  {proposal.sections.map((s, i) => (
                    <div key={i} className="border border-zinc-800 rounded-lg">
                      <button
                        onClick={() => toggleSection(s.title)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium text-sm">{s.title}</span>
                          {s.requiresReview && <Badge variant="outline" className="text-amber-400 text-xs border-amber-500/30">Review</Badge>}
                        </div>
                        {expandedSections.has(s.title) ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                      </button>
                      <AnimatePresence>
                        {expandedSections.has(s.title) && (
                          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                            <div className="p-3 pt-0">
                              <pre className="text-zinc-300 text-sm whitespace-pre-wrap font-sans">{s.content}</pre>
                              <p className="text-zinc-600 text-xs mt-2">Source: {s.dataSource}</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
