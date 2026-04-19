"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, FileText, Loader2, RefreshCw } from "lucide-react";
import { generateMeetingBrief } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface MeetingRecord {
  id: string;
  title: string;
  type: string;
  scheduledAt: string | Date;
  briefGenerated: boolean;
  briefText: string | null;
  client: {
    id: string;
    name: string;
  };
}

interface BriefEvidence {
  id: string;
  title: string;
  sectionPath: string;
  text: string;
  effectiveDate: string | null;
  authorityLevel: string;
  kind: string;
}

interface BriefSchema {
  meeting_id: string;
  household_id: string;
  meeting_type: string;
  generated_at: string;
  sections: Array<{
    key: string;
    title: string;
    content: string;
    claims: Array<{ text: string; citations: string[]; verified: boolean }>;
  }>;
  open_questions: string[];
  warnings: string[];
  compliance_flags: Array<{ severity: string; message: string; citations: string[] }>;
  overall_confidence: string;
  evidence?: BriefEvidence[];
  meetingBriefId?: string;
}

function parseBrief(briefText: string | null): BriefSchema | null {
  if (!briefText) return null;
  try {
    const parsed = JSON.parse(briefText) as BriefSchema;
    return parsed?.sections ? parsed : null;
  } catch {
    return null;
  }
}

function formatMeetingDate(value: string | Date) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function severityBadge(severity: string) {
  switch (severity.toLowerCase()) {
    case "high":
    case "critical":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "medium":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }
}

export function MeetingsClient({ meetings }: { meetings: MeetingRecord[] }) {
  const sortedMeetings = useMemo(
    () => [...meetings].sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime()),
    [meetings],
  );
  const households = useMemo(
    () =>
      sortedMeetings.reduce<Array<{ id: string; name: string }>>((list, meeting) => {
        if (list.some((item) => item.id === meeting.client.id)) return list;
        list.push({ id: meeting.client.id, name: meeting.client.name });
        return list;
      }, []),
    [sortedMeetings],
  );

  const [selectedHouseholdId, setSelectedHouseholdId] = useState(households[0]?.id ?? "");
  const [selectedMeetingId, setSelectedMeetingId] = useState(sortedMeetings[0]?.id ?? "");
  const [selectedCitationId, setSelectedCitationId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const visibleMeetings = sortedMeetings.filter((meeting) =>
    selectedHouseholdId ? meeting.client.id === selectedHouseholdId : true,
  );

  const selectedMeeting =
    visibleMeetings.find((meeting) => meeting.id === selectedMeetingId) ??
    visibleMeetings[0] ??
    sortedMeetings[0] ??
    null;

  const brief = parseBrief(selectedMeeting?.briefText ?? null);
  const evidence = (brief?.evidence ?? []).filter((item) => sourceFilter === "all" || item.kind === sourceFilter);
  const selectedEvidence =
    evidence.find((item) => item.id === selectedCitationId) ??
    brief?.evidence?.find((item) => item.id === selectedCitationId) ??
    evidence[0] ??
    brief?.evidence?.[0] ??
    null;

  const handleRegenerate = () => {
    if (!selectedMeeting) return;
    startTransition(async () => {
      try {
        await generateMeetingBrief(selectedMeeting.id);
        toast.success("Meeting brief regenerated", {
          description: `Updated evidence-backed brief for ${selectedMeeting.title}.`,
        });
        window.location.reload();
      } catch (error) {
        toast.error("Meeting brief generation failed", {
          description: error instanceof Error ? error.message : "Unable to regenerate meeting prep.",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-white/92">Meeting Prep</h1>
        <p className="text-sm text-zinc-400">
          Evidence-backed prep for advisor meetings. Every claim must resolve to a source chunk or deterministic calculation.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <Card className="border-white/10 bg-zinc-950/70">
          <CardHeader className="space-y-1">
            <CardTitle className="text-sm font-medium text-zinc-200">Meeting Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Household</div>
              <Select
                value={selectedHouseholdId}
                onValueChange={(value) => {
                  const nextHouseholdId = value ?? "";
                  setSelectedHouseholdId(nextHouseholdId);
                  const nextMeeting = sortedMeetings.find((meeting) => meeting.client.id === nextHouseholdId);
                  setSelectedMeetingId(nextMeeting?.id ?? "");
                  setSelectedCitationId(null);
                }}
              >
                <SelectTrigger className="border-white/10 bg-black/30 text-zinc-100">
                  <SelectValue placeholder="Select household" />
                </SelectTrigger>
                <SelectContent>
                  {households.map((household) => (
                    <SelectItem key={household.id} value={household.id}>
                      {household.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Upcoming Meeting</div>
              <Select
                value={selectedMeeting?.id ?? ""}
                onValueChange={(value) => {
                  setSelectedMeetingId(value ?? "");
                  setSelectedCitationId(null);
                }}
              >
                <SelectTrigger className="border-white/10 bg-black/30 text-zinc-100">
                  <SelectValue placeholder="Select meeting" />
                </SelectTrigger>
                <SelectContent>
                  {visibleMeetings.map((meeting) => (
                    <SelectItem key={meeting.id} value={meeting.id}>
                      {meeting.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMeeting ? (
                <div className="text-xs text-zinc-500">{formatMeetingDate(selectedMeeting.scheduledAt)}</div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Source Filter</div>
              <Select
                value={sourceFilter}
                onValueChange={(value) => {
                  setSourceFilter(value ?? "all");
                  setSelectedCitationId(null);
                }}
              >
                <SelectTrigger className="border-white/10 bg-black/30 text-zinc-100">
                  <SelectValue placeholder="All evidence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All evidence</SelectItem>
                  <SelectItem value="document_chunk">Document chunks</SelectItem>
                  <SelectItem value="meeting_note">Meeting notes</SelectItem>
                  <SelectItem value="task">Tasks</SelectItem>
                  <SelectItem value="holding">Holdings</SelectItem>
                  <SelectItem value="deterministic_calculation">Calculations</SelectItem>
                  <SelectItem value="compliance_flag">Compliance flags</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleRegenerate}
              disabled={!selectedMeeting || isPending}
              className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Regenerate Brief
            </Button>

            {brief ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-400">
                <div className="mb-2 flex items-center justify-between">
                  <span>Confidence</span>
                  <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-100">
                    {brief.overall_confidence}
                  </Badge>
                </div>
                <div className="text-zinc-500">Generated {formatMeetingDate(brief.generated_at)}</div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                No grounded brief stored yet for this meeting. Generate the brief to start review.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-950/70">
          <CardHeader className="border-b border-white/5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-medium text-zinc-100">
                  {selectedMeeting?.title ?? "No meeting selected"}
                </CardTitle>
                {selectedMeeting ? (
                  <div className="mt-1 text-sm text-zinc-500">
                    {selectedMeeting.client.name} · {formatMeetingDate(selectedMeeting.scheduledAt)}
                  </div>
                ) : null}
              </div>
              {brief ? (
                <Badge className="border-white/10 bg-white/5 text-zinc-200">{brief.meeting_type}</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {!brief ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-8 text-sm text-zinc-400">
                This meeting does not yet have a source-grounded brief.
              </div>
            ) : (
              <div className="space-y-8">
                {brief.warnings.length > 0 ? (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-200">
                      <AlertTriangle className="h-4 w-4" />
                      Warnings
                    </div>
                    <ul className="space-y-1 text-sm text-amber-100/90">
                      {brief.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {brief.sections.map((section) => (
                  <section key={section.key} className="space-y-3">
                    <div className="border-b border-white/10 pb-2">
                      <h2 className="text-lg font-medium text-zinc-100">{section.title}</h2>
                    </div>
                    <p className="text-sm leading-7 text-zinc-200">{section.content}</p>
                    <div className="space-y-2">
                      {section.claims.map((claim) => (
                        <div key={`${section.key}-${claim.text}`} className="rounded-xl border border-white/8 bg-black/20 p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={claim.verified ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200"}
                            >
                              {claim.verified ? "Verified" : "Unverified"}
                            </Badge>
                          </div>
                          <div className="text-sm text-zinc-100">{claim.text}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {claim.citations.map((citation) => (
                              <button
                                key={citation}
                                type="button"
                                onClick={() => setSelectedCitationId(citation)}
                                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                                  selectedCitationId === citation
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                    : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20 hover:bg-white/10"
                                }`}
                              >
                                {citation}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}

                {brief.compliance_flags.length > 0 ? (
                  <section className="space-y-3">
                    <div className="border-b border-white/10 pb-2">
                      <h2 className="text-lg font-medium text-zinc-100">Compliance Review</h2>
                    </div>
                    <div className="space-y-2">
                      {brief.compliance_flags.map((flag, index) => (
                        <div key={`${flag.message}-${index}`} className="rounded-xl border border-white/8 bg-black/20 p-3">
                          <Badge className={severityBadge(flag.severity)}>{flag.severity}</Badge>
                          <div className="mt-2 text-sm text-zinc-100">{flag.message}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-950/70">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="text-sm font-medium text-zinc-200">Evidence Panel</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!brief ? (
              <div className="p-6 text-sm text-zinc-500">Evidence will appear once a grounded brief has been generated.</div>
            ) : (
              <div className="grid h-[calc(100vh-18rem)] grid-rows-[1fr_auto]">
                <ScrollArea>
                  <div className="space-y-2 p-4">
                    {evidence.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedCitationId(item.id)}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          selectedEvidence?.id === item.id
                            ? "border-emerald-500/30 bg-emerald-500/10"
                            : "border-white/8 bg-black/20 hover:border-white/15 hover:bg-black/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-zinc-100">{item.title}</div>
                            <div className="mt-1 text-xs text-zinc-500">{item.sectionPath}</div>
                          </div>
                          <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-300">
                            {item.kind}
                          </Badge>
                        </div>
                        <div className="mt-3 line-clamp-4 text-sm leading-6 text-zinc-300">{item.text}</div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>

                <div className="border-t border-white/5 p-4">
                  {selectedEvidence ? (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 text-zinc-500" />
                        <div>
                          <div className="text-sm font-medium text-zinc-100">{selectedEvidence.title}</div>
                          <div className="text-xs text-zinc-500">{selectedEvidence.sectionPath}</div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-black/30 p-3 text-sm leading-6 text-zinc-200">
                        {selectedEvidence.text}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs text-zinc-500">
                        <div>
                          <div className="uppercase tracking-[0.12em] text-zinc-600">Effective Date</div>
                          <div className="mt-1 text-zinc-300">
                            {selectedEvidence.effectiveDate ? formatMeetingDate(selectedEvidence.effectiveDate) : "Not recorded"}
                          </div>
                        </div>
                        <div>
                          <div className="uppercase tracking-[0.12em] text-zinc-600">Authority</div>
                          <div className="mt-1 text-zinc-300">{selectedEvidence.authorityLevel}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-500">Select a citation to inspect the supporting evidence.</div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
