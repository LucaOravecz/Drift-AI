/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Printer, Calendar, Clock, Sparkles, AlertTriangle, MessageSquare, Loader2, RefreshCw } from "lucide-react";
import { generateMeetingBrief, syncCalendar } from "@/lib/actions";
import { motion } from "framer-motion";
import { toast } from "sonner";

function formatDate(d: any) {
  const date = new Date(d);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  if (diff < 0) return "Past";
  if (diff < 8 * 3600000) return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (diff < 30 * 3600000) return `Tomorrow, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function BriefDisplay({ brief }: { brief: string }) {
  let data: any = null;
  try { data = JSON.parse(brief); } catch { return <div className="text-sm text-zinc-400 p-4">{brief}</div>; }

  // New grounded brief format (sections array)
  if (data.sections) {
    return (
      <div className="bg-card w-full max-w-4xl my-6 border border-white/5 shadow-sm rounded-xl p-8 lg:p-10 space-y-6 text-sm">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div>
            <div className="text-xs text-zinc-500 mb-1">Meeting Brief — {data.clientName}</div>
            <div className="flex items-center gap-2">
              <Badge className={`text-[9px] border ${
                data.generatedBy === "AI_ASSISTED"
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
              }`}>
                {data.generatedBy === "AI_ASSISTED" ? "Deterministic + AI Talking Points" : "Deterministic Only"}
              </Badge>
              <Badge className={`text-[9px] border ${
                data.dataQuality === "HIGH" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : data.dataQuality === "MEDIUM" ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>
                Data quality: {data.dataQuality}
              </Badge>
            </div>
          </div>
          <div className="text-[10px] text-zinc-600 font-mono text-right">
            {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : ""}
          </div>
        </div>

        {/* Sections */}
        {data.sections?.map((section: any, i: number) => (
          <section key={i}>
            <div className="flex items-center gap-2 mb-2 border-b border-white/5 pb-2">
              <h3 className={`text-sm font-semibold ${section.available ? "text-white/90" : "text-zinc-600"}`}>
                {section.title}
              </h3>
              <span className="text-[9px] font-mono text-zinc-700 ml-auto">
                source: {section.source}
              </span>
            </div>

            {section.available && section.content ? (
              <>
                {Array.isArray(section.content) ? (
                  <ul className="space-y-1">
                    {section.content.map((item: string, j: number) => (
                      <li key={j} className="flex items-start gap-2 text-zinc-300 text-xs">
                        <span className="text-primary mt-0.5 shrink-0">▸</span> {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-zinc-300 text-xs leading-relaxed">{section.content}</p>
                )}
                {section.note && (
                  <p className="text-[10px] text-amber-500/70 mt-2 italic">{section.note}</p>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 py-2">
                <span className="text-zinc-700 text-xs italic">
                  {section.note ?? "No data available for this section"}
                </span>
              </div>
            )}

            {section.missingData?.length > 0 && (
              <div className="mt-2 text-[10px] text-zinc-600">
                Missing: {section.missingData.join(", ")}
              </div>
            )}
          </section>
        ))}

        {/* AI Talking Points (clearly labeled) */}
        {data.aiTalkingPoints?.items?.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2 border-b border-blue-500/10 pb-2">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              <h3 className="text-sm font-semibold text-blue-400">AI-Suggested Talking Points</h3>
              <span className="text-[9px] font-mono text-zinc-600 ml-auto">AI Draft — review required</span>
            </div>
            <p className="text-[10px] text-zinc-600 mb-2 italic">{data.aiTalkingPoints.label}</p>
            <ul className="space-y-2">
              {data.aiTalkingPoints.items.map((tp: string, i: number) => (
                <li key={i} className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3 text-zinc-300 text-xs">{tp}</li>
              ))}
            </ul>
          </section>
        )}

        {/* AI Follow-Up Questions */}
        {data.aiFollowUpQuestions?.items?.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2 border-b border-blue-500/10 pb-2">
              <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
              <h3 className="text-sm font-semibold text-blue-400">AI-Suggested Follow-Up Questions</h3>
              <span className="text-[9px] font-mono text-zinc-600 ml-auto">AI Draft — review required</span>
            </div>
            <ul className="space-y-1">
              {data.aiFollowUpQuestions.items.map((q: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-zinc-300 text-xs">
                  <span className="text-blue-400 mt-0.5 shrink-0">?</span> {q}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Missing data summary */}
        {data.missingData?.length > 0 && (
          <section className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <h3 className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" /> Missing Data — Brief Quality Impact
            </h3>
            <ul className="space-y-0.5">
              {data.missingData.map((m: string, i: number) => (
                <li key={i} className="text-[10px] text-amber-500/70">• {m}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Disclaimer */}
        <div className="pt-4 border-t border-white/5 text-[10px] text-zinc-600 font-mono leading-relaxed">
          {data.disclaimer}
        </div>
      </div>
    );
  }

  // Legacy brief format fallback (pre-grounded-engine briefs stored in DB)
  return (
    <div className="bg-card w-full max-w-4xl my-6 border border-amber-500/20 shadow-sm rounded-xl p-8 lg:p-10 space-y-4 text-sm">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="text-xs text-amber-400">Legacy brief format — regenerate to use grounded data engine</span>
      </div>
      {data.snapshot && (
        <section>
          <h3 className="text-base font-bold mb-3 border-b border-white/5 pb-2 text-white/90">Client Snapshot</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(data.snapshot).map(([k, v]: any) => (
              <div key={k} className="bg-white/[0.03] p-3 rounded-lg border border-white/5">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">{k.replace(/([A-Z])/g, " $1")}</div>
                <div className="font-semibold text-white/80 text-sm">{String(v)}</div>
              </div>
            ))}
          </div>
        </section>
      )}
      {data.advisorNotes && (
        <div className="text-xs text-zinc-500 italic pt-2">{data.advisorNotes}</div>
      )}
      <div className="pt-4 border-t border-white/5 text-[10px] text-zinc-600 font-mono">
        Legacy format — Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "unknown"}
      </div>
    </div>
  );
}

export function MeetingsClient({ meetings, upcoming }: { meetings: any[]; upcoming: any[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    meetings.find((m) => m.briefGenerated)?.id ?? meetings[0]?.id ?? null
  );
  const [isPending, startTransition] = useTransition();
  const [localMeetings, setLocalMeetings] = useState(meetings);

  const selected = localMeetings.find((m) => m.id === selectedId);

  const handleGenerateBrief = () => {
    if (!selectedId) return;
    startTransition(async () => {
      try {
        await generateMeetingBrief(selectedId);
        toast.success("Brief generated", {
          description: `Intelligence snapshot for ${selected?.title} is now ready.`
        });
        window.location.reload();
      } catch (err) {
        toast.error("Generation failed", {
          description: err instanceof Error ? err.message : "AI engine error during synthesis."
        });
      }
    });
  };

  const sidebar = [...upcoming, ...meetings.filter((m) => !upcoming.some((u) => u.id === m.id))];

  const handleSync = () => {
    startTransition(async () => {
      try {
        const result = await syncCalendar();
        toast.success("Calendar synchronized successfully", {
          description: result?.imported
            ? `${result.imported} meeting(s) were imported from the configured calendar integration.`
            : "Calendar sync completed, but no meetings matched stored clients."
        });
      } catch (err) {
        toast.error("Calendar sync failed", {
          description: err instanceof Error ? err.message : "Institutional connection issue detected."
        });
      }
    });
  };

  const handlePrint = () => {
    if (!selected?.briefGenerated) {
      toast.warning("Nothing to print", {
        description: "Please generate a brief first to create a printable report."
      });
      return;
    }
    window.print();
    toast.info("Preparing print view", {
      description: "Generating institutional pre-meeting brief PDF..."
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white/90">Meeting Briefs</h1>
          <p className="text-zinc-400 mt-1">Persisted pre-meeting briefs built from stored client data and optional grounded AI organization.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="border-white/10 bg-white/5 text-zinc-300"
            onClick={handleSync}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
            Sync Calendar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4 lg:grid-cols-5" style={{ height: "800px" }}>
        {/* Sidebar */}
        <Card className="col-span-1 border-white/5 flex flex-col h-full bg-white/[0.02]">
          <CardHeader className="py-4 border-b border-white/5">
            <CardTitle className="text-sm text-zinc-400 font-medium">Meetings</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="flex flex-col divide-y divide-white/5">
                {sidebar.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={`p-3 cursor-pointer transition-colors ${selectedId === m.id ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-white/[0.03] border-l-2 border-transparent"}`}
                  >
                    <div className={`font-medium text-sm ${selectedId === m.id ? "text-white" : "text-zinc-400"}`}>{m.title}</div>
                    <div className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" /> {formatDate(m.scheduledAt)}
                    </div>
                    <div className="mt-2">
                      {m.briefGenerated ? (
                        <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Brief Ready</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-zinc-600 border-zinc-700">No Brief</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Brief Panel */}
        <Card className="md:col-span-3 lg:col-span-4 h-full flex flex-col overflow-hidden bg-white/[0.02] border-white/5">
          {selected ? (
            <>
              <CardHeader className="py-4 border-b border-white/5 flex flex-row items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">Pre-Meeting Brief</Badge>
                      {selected.briefGenerated && (
                      <span className="text-[10px] text-zinc-600">Stored on meeting record</span>
                      )}
                    </div>
                  <CardTitle className="text-xl text-white/90">{selected.title}</CardTitle>
                  <CardDescription>{selected.attendees ?? "Attendees not set"}</CardDescription>
                </div>
                <div className="flex gap-2">
                  {!selected.briefGenerated ? (
                    <Button
                      size="sm"
                      onClick={handleGenerateBrief}
                      disabled={isPending}
                      className="bg-primary hover:bg-primary/90 shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                    >
                      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Generate Brief
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateBrief}
                      disabled={isPending}
                      className="border-white/10 bg-white/5 text-zinc-300"
                    >
                      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Regenerate
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-white/10 bg-white/5 text-zinc-300"
                    onClick={handlePrint}
                  >
                    <Printer className="mr-2 h-4 w-4" /> Print
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-y-auto flex flex-col items-center bg-black/20">
                {selected.briefGenerated && selected.briefText ? (
                  <BriefDisplay brief={selected.briefText} />
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-64 gap-4 text-center"
                  >
                    <Sparkles className="h-8 w-8 text-zinc-700" />
                    <div className="text-zinc-500">No brief generated yet.</div>
                    <div className="text-zinc-600 text-sm max-w-xs">
                      Click &quot;Generate Brief&quot; to store a grounded pre-meeting package from client records, tasks, opportunities, and related data.
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-zinc-600">Select a meeting to view its brief.</div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
