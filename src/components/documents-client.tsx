"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, AlertCircle, CheckCircle2, Loader2, RefreshCw, FileArchive, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { processDocument, markDocumentReviewed } from "@/lib/actions";
import { toast } from "sonner";

function parseJson(str: string | null): string[] {
  if (!str) return [];
  try { return JSON.parse(str) as string[]; } catch { return [str]; }
}

const statusColors: Record<string, string> = {
  UPLOADED: "text-zinc-400 bg-zinc-800 border-zinc-700",
  QUEUED: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  PROCESSING: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  SUMMARIZED: "text-primary bg-primary/10 border-primary/20",
  REVIEWED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

export function DocumentsClient({ documents, stats, clients }: { documents: any[]; stats: any; clients?: { id: string; name: string }[] }) {
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(documents[0]?.id ?? null);
  const [localDocs, setLocalDocs] = useState(documents);
  const [uploading, setUploading] = useState(false);
  const [uploadClientId, setUploadClientId] = useState<string>(clients?.[0]?.id ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const selected = localDocs.find((d) => d.id === selectedId);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadClientId) return;
    setUploading(true);
    const toastId = toast.loading("Uploading institutional document...");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("clientId", uploadClientId);
      const res = await fetch("/api/documents/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const { document: doc } = await res.json();
      setLocalDocs((prev) => [doc, ...prev]);
      setSelectedId(doc.id);
      toast.success("Upload complete", {
        id: toastId,
        description: "File successfully ingested into Document Vault."
      });
    } catch (err) {
      toast.error("Upload failed", {
        id: toastId,
        description: err instanceof Error ? err.message : "System error."
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleProcess = (id: string) => {
    setActiveId(id);
    startTransition(async () => {
      try {
        await processDocument(id);
        toast.success("Analysis complete", {
          description: "AI has summarized the document and identified action items."
        });
        setLocalDocs((prev) => prev.map((d) => d.id === id ? { ...d, status: "SUMMARIZED" } : d));
      } catch (err) {
        toast.error("Processing error.");
      }
      setActiveId(null);
    });
  };

  const handleReviewed = (id: string) => {
    setActiveId(id);
    startTransition(async () => {
      try {
        await markDocumentReviewed(id);
        toast.success("Review logged", {
          description: "Document state updated in client profile. Audit trail synchronized."
        });
        setLocalDocs((prev) => prev.map((d) => d.id === id ? { ...d, status: "REVIEWED" } : d));
      } catch (err) {
        toast.error("Review failed.");
      }
      setActiveId(null);
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white/90">Document Intelligence</h1>
          <p className="text-zinc-400 mt-1">Turn 200-page documents into focused 1-page executive briefs.</p>
        </div>
        <div className="flex items-center gap-2">
          {clients && clients.length > 0 && (
            <Select value={uploadClientId} onValueChange={(v) => { if (v) setUploadClientId(v); }}>
              <SelectTrigger className="h-9 text-xs bg-black/40 border-white/10 text-zinc-300 w-44">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.xlsx,.csv" className="hidden" onChange={handleUpload} />
          <Button variant="outline" className="border-white/10 bg-white/5 text-zinc-300 h-9 text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
            {uploading ? "Uploading..." : "Upload Document"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Documents", value: stats.total, color: "text-white" },
          { label: "Summarized", value: stats.summarized, color: "text-primary" },
          { label: "Processing", value: stats.processing, color: "text-amber-400" },
          { label: "Reviewed", value: stats.reviewed, color: "text-emerald-400" },
        ].map((s) => (
          <Card key={s.label} className="bg-white/[0.02] border-white/5">
            <CardContent className="pt-4 pb-3">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-5" style={{ height: "700px" }}>
        {/* Document List */}
        <Card className="md:col-span-1 h-full flex flex-col bg-white/[0.02] border-white/5">
          <CardHeader className="py-4 border-b border-white/5">
            <CardTitle className="text-sm text-zinc-400 font-medium">Document Vault</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="flex flex-col divide-y divide-white/5">
                {localDocs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedId(doc.id)}
                    className={`p-3 cursor-pointer transition-colors ${selectedId === doc.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-white/[0.03] border-l-2 border-transparent"}`}
                  >
                    <div className={`font-medium text-xs ${selectedId === doc.id ? "text-white" : "text-zinc-400"} leading-snug`}>{doc.fileName}</div>
                    <div className="text-[10px] text-zinc-600 mt-1">{doc.pageCount ? `${doc.pageCount} pages` : "Unknown pages"} · {(doc.fileSize / 1000000).toFixed(1)} MB</div>
                    <Badge className={`mt-1.5 text-[9px] ${statusColors[doc.status] ?? ""}`}>{doc.status}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Document Viewer */}
        <Card className="md:col-span-4 h-full flex flex-col overflow-hidden bg-white/[0.02] border-white/5">
          {selected ? (
            <>
              <CardHeader className="py-4 border-b border-white/5 flex flex-row items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`text-[10px] ${statusColors[selected.status] ?? ""}`}>{selected.status}</Badge>
                    {selected.documentType && (
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wide">{selected.documentType.replace(/_/g, " ")}</span>
                    )}
                  </div>
                  <CardTitle className="text-lg text-white/90">{selected.fileName}</CardTitle>
                  <CardDescription>Client: {selected.client?.name} · {selected.pageCount ?? "?"} pages</CardDescription>
                </div>
                <div className="flex gap-2 shrink-0">
                  {selected.status === "UPLOADED" || selected.status === "QUEUED" ? (
                    <Button size="sm" className="h-8 text-xs bg-primary hover:bg-primary/90"
                      disabled={isPending && activeId === selected.id} onClick={() => handleProcess(selected.id)}>
                      {isPending && activeId === selected.id ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Processing...</> : <><RefreshCw className="mr-2 h-3 w-3" />Process Document</>}
                    </Button>
                  ) : selected.status === "SUMMARIZED" ? (
                    <Button size="sm" className="h-8 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                      disabled={isPending && activeId === selected.id} onClick={() => handleReviewed(selected.id)}>
                      {isPending && activeId === selected.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="mr-2 h-3 w-3" />Mark Reviewed</>}
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto pt-6 pb-6">
                {selected.status === "PROCESSING" ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-4">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    <div className="text-zinc-500">AI is analyzing the document...</div>
                  </div>
                ) : selected.summaryText ? (
                  <div className="space-y-6 max-w-3xl">
                    {/* Summary */}
                    <section>
                      <h3 className="text-sm font-bold text-white/80 mb-2 pb-1 border-b border-white/5">Executive Summary</h3>
                      <p className="text-sm text-zinc-300 leading-relaxed">{selected.summaryText}</p>
                    </section>

                    {/* Key Points */}
                    {parseJson(selected.keyPoints).length > 0 && (
                      <section>
                        <h3 className="text-sm font-bold text-white/80 mb-2 pb-1 border-b border-white/5">Key Points</h3>
                        <ul className="space-y-1.5">
                          {parseJson(selected.keyPoints).map((pt, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                              <span className="text-primary mt-1 shrink-0">▸</span>{pt}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {/* Action Items */}
                    {parseJson(selected.actionItems).length > 0 && (
                      <section>
                        <h3 className="text-sm font-bold text-white/80 mb-2 pb-1 border-b border-white/5 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />Action Items
                        </h3>
                        <ul className="space-y-1.5">
                          {parseJson(selected.actionItems).map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                              <span className="text-emerald-500 mt-1 shrink-0">✓</span>{item}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {/* Risk Items */}
                    {parseJson(selected.riskItems).length > 0 && (
                      <section>
                        <h3 className="text-sm font-bold text-white/80 mb-2 pb-1 border-b border-white/5 flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-red-500" />Risk Flags
                        </h3>
                        <ul className="space-y-2">
                          {parseJson(selected.riskItems).map((risk, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-zinc-300 bg-red-500/5 border border-red-500/10 rounded-lg p-2.5">
                              <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />{risk}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {/* Deadlines */}
                    {parseJson(selected.deadlines).length > 0 && (
                      <section>
                        <h3 className="text-sm font-bold text-white/80 mb-2 pb-1 border-b border-white/5">Deadlines</h3>
                        <ul className="space-y-1.5">
                          {parseJson(selected.deadlines).map((dl, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-amber-400 bg-amber-500/5 border border-amber-500/10 rounded-lg p-2.5">
                              <span className="text-amber-500 shrink-0">!</span>{dl}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    <div className="pt-4 border-t border-white/5 text-[10px] text-zinc-600 font-mono">
                      Processed by Drift AI Document Intelligence · Advisor review required before client action
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
                    <FileText className="h-8 w-8 text-zinc-700" />
                    <div className="text-zinc-500">Document not yet processed.</div>
                    <div className="text-zinc-600 text-sm">Click "Process Document" to run AI analysis.</div>
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-full text-zinc-600">
              Select a document to view its analysis.
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
