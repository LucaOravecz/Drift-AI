/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Gift, Sparkles, Send, CheckCircle2, Loader2, X } from "lucide-react";
import { motion } from "framer-motion";
import {
  approveCommunication,
  sendCommunication,
  sendRelationshipOutreach,
  completeRelationshipEvent,
  generateCommunicationDraft,
  dismissCommunication,
} from "@/lib/actions";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  PENDING_APPROVAL: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  APPROVED: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  SENT: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  DRAFT: "text-zinc-400 bg-zinc-500/10 border-zinc-700",
};

const eventTypeIcons: Record<string, any> = {
  BIRTHDAY: "🎂",
  ANNIVERSARY: "🥂",
  MILESTONE: "🏆",
  CHECK_IN: "👋",
  REFERRAL_MOMENT: "🤝",
  GIFT: "🎁",
};

export function CommunicationsClient({ comms, events, stats, clients }: { comms: any[]; events: any[]; stats: any; clients: any[] }) {
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localComms, setLocalComms] = useState(comms);
  const [localEvents, setLocalEvents] = useState(events);
  const [generating, setGenerating] = useState(false);
  const [selectedClient, setSelectedClient] = useState(clients[0]?.id ?? "");

  const handleApprove = (id: string) => {
    setActiveId(id);
    startTransition(async () => {
      try {
        const res = await approveCommunication(id);
        if (res && !res.success) {
          toast.error("Approval failed", { description: res.error });
          setActiveId(null);
          return;
        }
        toast.success("Communication approved", {
          description: "Draft has been staged for final institutional send."
        });
        setLocalComms((prev) => prev.map((c) => (c.id === id ? { ...c, status: "APPROVED" } : c)));
      } catch (err) {
        toast.error("Security/Network error during approval.");
      }
      setActiveId(null);
    });
  };

  const handleReject = (id: string) => {
    setActiveId(id);
    startTransition(async () => {
      try {
        await dismissCommunication(id);
        toast.info("Communication rejected", {
          description: "Draft has been removed from the queue and archived."
        });
        setLocalComms((prev) => prev.filter((c) => c.id !== id));
      } catch (err) {
        toast.error("Rejection failed.");
      }
      setActiveId(null);
    });
  };

  const handleSend = (id: string) => {
    setActiveId(id);
    startTransition(async () => {
      try {
        await sendCommunication(id);
        toast.success("Institutional email sent", {
          description: "Client message has been dispatched and logged in the audit trail."
        });
        setLocalComms((prev) => prev.map((c) => (c.id === id ? { ...c, status: "SENT" } : c)));
      } catch (err) {
        toast.error("Send failed", {
          description: err instanceof Error ? err.message : "Institutional relay encountered an error."
        });
      }
      setActiveId(null);
    });
  };

  const handleOutreach = (id: string) => {
    setActiveId(id);
    startTransition(async () => {
      try {
        await sendRelationshipOutreach(id);
        toast.success("Relationship outreach dispatched", {
          description: "Concierge-level message sent to client."
        });
        setLocalEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status: "OUTREACH_SENT" } : e)));
      } catch (err) {
        toast.error("Outreach failed.");
      }
      setActiveId(null);
    });
  };

  const handleCompleteEvent = (id: string) => {
    setActiveId(id);
    startTransition(async () => {
      await completeRelationshipEvent(id);
      setLocalEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status: "COMPLETED" } : e)));
      setActiveId(null);
    });
  };

  const handleGenerate = () => {
    if (!selectedClient) return;
    setGenerating(true);
    startTransition(async () => {
      try {
        await generateCommunicationDraft(selectedClient, "CHECK_IN");
        toast.success("Draft generated", {
          description: "Personalized institutional draft is now in the queue."
        });
        window.location.reload();
      } catch (err) {
        toast.error("AI generation unsuccessful.");
      }
      setGenerating(false);
    });
  };

  const pendingComms = localComms.filter((c) => c.status === "PENDING_APPROVAL");
  const sentComms = localComms.filter((c) => c.status === "SENT");
  const pendingEvents = localEvents.filter((e) => e.status === "PENDING");
  const completedEvents = localEvents.filter((e) => ["COMPLETED", "OUTREACH_SENT"].includes(e.status));

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white/90">Relationship Engine</h1>
          <p className="text-zinc-400 mt-1">Stored relationship events, governed outreach drafts, and integration-backed delivery.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pending Approval", value: stats.pending, color: "text-amber-400" },
          { label: "Sent This Month", value: stats.sent, color: "text-emerald-400" },
          { label: "Relationship Events", value: stats.relationshipEventsPending, color: "text-primary" },
          { label: "Total Drafts", value: stats.total, color: "text-white" },
        ].map((s) => (
          <Card key={s.label} className="bg-white/[0.02] border-white/5">
            <CardContent className="pt-4 pb-3">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="relationship" className="w-full">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="relationship" className="data-[state=active]:bg-white/10">
            Relationship Events {pendingEvents.length > 0 && <span className="ml-1.5 bg-amber-500/20 text-amber-400 text-[9px] px-1.5 py-0.5 rounded-full">{pendingEvents.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="queue" className="data-[state=active]:bg-white/10">
            Approval Queue {pendingComms.length > 0 && <span className="ml-1.5 bg-amber-500/20 text-amber-400 text-[9px] px-1.5 py-0.5 rounded-full">{pendingComms.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="generate" className="data-[state=active]:bg-white/10">Generate Draft</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-white/10">Sent History</TabsTrigger>
        </TabsList>

        {/* Relationship Events */}
        <TabsContent value="relationship" className="mt-5">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {pendingEvents.map((event) => (
              <motion.div key={event.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-white/[0.02] border-white/5 flex flex-col hover:border-white/10 transition-colors">
                  <CardHeader className="pb-3 border-b border-white/5">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/20 bg-primary/5">
                        {event.type.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-lg">{eventTypeIcons[event.type] ?? "📌"}</span>
                    </div>
                    <CardTitle className="text-base text-white/90">{event.title}</CardTitle>
                    <CardDescription className="text-xs">{event.client?.name}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 gap-3 pt-4">
                    {event.description && (
                      <p className="text-xs text-zinc-400 leading-relaxed">{event.description}</p>
                    )}
                    {event.draftMessage && (
                      <div>
                        <div className="text-[10px] font-medium text-zinc-500 mb-1.5 flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-primary" /> AI Draft
                        </div>
                        <Textarea
                          className="text-xs resize-none h-20 bg-white/[0.03] border-white/10 text-zinc-300"
                          defaultValue={event.draftMessage}
                          readOnly
                        />
                      </div>
                    )}
                    {event.giftSuggestion && (
                      <div className="text-xs text-zinc-500 flex items-start gap-1.5">
                        <Gift className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                        {event.giftSuggestion}
                      </div>
                    )}
                    <div className="flex gap-2 mt-auto pt-2">
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                        disabled={isPending && activeId === event.id}
                        onClick={() => handleOutreach(event.id)}
                      >
                        {isPending && activeId === event.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Send className="mr-1 h-3 w-3" />Send Outreach</>}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-zinc-600 hover:text-zinc-400"
                        disabled={isPending && activeId === event.id}
                        onClick={() => handleCompleteEvent(event.id)}
                      >
                        Done
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {pendingEvents.length === 0 && (
              <div className="col-span-3 text-center py-12 text-zinc-600">No pending relationship events.</div>
            )}
          </div>
        </TabsContent>

        {/* Approval Queue */}
        <TabsContent value="queue" className="mt-5">
          <div className="flex flex-col gap-4">
            {pendingComms.map((comm) => (
              <Card key={comm.id} className="bg-white/[0.02] border-white/5 border-amber-500/10">
                <CardHeader className="pb-2 border-b border-white/5">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-sm text-white/90">{comm.subject}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">To: {comm.client?.name}</CardDescription>
                    </div>
                    <Badge className={`text-[10px] ${statusColors[comm.status] ?? ""}`}>{comm.status.replace("_", " ")}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-3">
                  <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 text-xs text-zinc-400 leading-relaxed mb-3 whitespace-pre-wrap">
                    {comm.body}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                      disabled={isPending && activeId === comm.id}
                      onClick={() => handleApprove(comm.id)}
                    >
                      {isPending && activeId === comm.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="mr-1 h-3 w-3" />Approve</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-primary/20 text-primary hover:bg-primary/10"
                      disabled={isPending && activeId === comm.id}
                      onClick={() => handleSend(comm.id)}
                    >
                      <Send className="mr-1 h-3 w-3" />Approve & Send
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-zinc-600 hover:text-destructive transition-colors ml-auto"
                      disabled={isPending && activeId === comm.id}
                      onClick={() => handleReject(comm.id)}
                    >
                      <X className="mr-1 h-3 w-3" />Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {pendingComms.length === 0 && (
              <div className="text-center py-12 text-zinc-600">No drafts awaiting approval.</div>
            )}
          </div>
        </TabsContent>

        {/* Generate Draft */}
        <TabsContent value="generate" className="mt-5">
          <Card className="bg-white/[0.02] border-white/5 max-w-lg">
            <CardHeader>
              <CardTitle className="text-base text-white/90">Generate AI Draft</CardTitle>
              <CardDescription>Select a client and template to generate an email draft for review.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Select Client</label>
                <select
                  className="w-full bg-white/[0.03] border border-white/10 rounded-md px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                >
                  {clients.map((c) => <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>)}
                </select>
              </div>
              <Button
                className="bg-primary hover:bg-primary/90 shadow-[0_0_15px_rgba(var(--primary),0.2)]"
                disabled={generating || isPending}
                onClick={handleGenerate}
              >
                {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : <><Sparkles className="mr-2 h-4 w-4" />Generate Check-In Draft</>}
              </Button>
              <p className="text-xs text-zinc-600">Generated drafts go into the Approval Queue for review before sending.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sent History */}
        <TabsContent value="history" className="mt-5">
          <div className="flex flex-col gap-3">
            {sentComms.map((comm) => (
              <Card key={comm.id} className="bg-white/[0.01] border-white/5 opacity-70">
                <CardContent className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-zinc-600 shrink-0" />
                    <div>
                      <div className="text-sm text-zinc-400">{comm.subject}</div>
                      <div className="text-xs text-zinc-600">{comm.client?.name} · {comm.sentAt ? new Date(comm.sentAt).toLocaleDateString() : "Date unknown"}</div>
                    </div>
                  </div>
                  <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shrink-0">SENT</Badge>
                </CardContent>
              </Card>
            ))}
            {sentComms.length === 0 && (
              <div className="text-center py-12 text-zinc-600">No sent communications yet.</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
