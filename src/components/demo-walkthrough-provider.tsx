"use client";

import { createContext, useContext, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  demoWalkthroughTracks,
  getDefaultDemoTrackForRole,
  getDefaultPersonaIdForTrack,
  getDefaultScenarioIdForTrack,
  getExpectedElapsedSeconds,
  getStepTargetSeconds,
  getWalkthroughStepIndex,
  type DemoTrackId,
} from "@/lib/demo-walkthrough";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  Copy,
  Download,
  Flag,
  Link2,
  PauseCircle,
  PlayCircle,
  Sparkles,
  Square,
  TimerReset,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "drift-demo-walkthrough";
const ANALYTICS_KEY = "drift-demo-analytics";
const REHEARSAL_PRESETS = [300, 600] as const;

function formatSeconds(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type DemoAnalytics = {
  startsByTrack: Record<string, number>;
  startsByScenario: Record<string, number>;
  exports: number;
  recapVisits: number;
};

type WalkthroughContextValue = {
  active: boolean;
  trackId: DemoTrackId;
  personaId: string;
  scenarioId: string;
  currentStepIndex: number;
  shareUrl: string;
  analytics: DemoAnalytics;
  checklist: Record<string, boolean>;
  startWalkthrough: () => void;
  stopWalkthrough: () => void;
  goToNext: () => void;
  goToPrevious: () => void;
  setTrackId: (trackId: DemoTrackId) => void;
  setPersonaId: (personaId: string) => void;
  setScenarioId: (scenarioId: string) => void;
  resetDemoState: () => void;
};

const WalkthroughContext = createContext<WalkthroughContextValue | null>(null);

function readAnalytics(): DemoAnalytics {
  if (typeof window === "undefined") {
    return { startsByTrack: {}, startsByScenario: {}, exports: 0, recapVisits: 0 };
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(ANALYTICS_KEY) ?? "{}") as Partial<DemoAnalytics>;
    return {
      startsByTrack: parsed.startsByTrack ?? {},
      startsByScenario: parsed.startsByScenario ?? {},
      exports: parsed.exports ?? 0,
      recapVisits: parsed.recapVisits ?? 0,
    };
  } catch {
    return { startsByTrack: {}, startsByScenario: {}, exports: 0, recapVisits: 0 };
  }
}

export function DemoWalkthroughProvider({ children, role }: { children: React.ReactNode; role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isExporting, startExportTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [analytics, setAnalytics] = useState<DemoAnalytics>(() => readAnalytics());
  const defaultTrackId = getDefaultDemoTrackForRole(role);
  const [initialState] = useState(() => {
    if (typeof window === "undefined") {
      return {
        active: false,
        currentStepIndex: 0,
        trackId: defaultTrackId,
        personaId: getDefaultPersonaIdForTrack(defaultTrackId),
        scenarioId: getDefaultScenarioIdForTrack(defaultTrackId),
        checklist: {},
      };
    }

    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as {
        active?: boolean;
        currentStepIndex?: number;
        trackId?: DemoTrackId;
        personaId?: string;
        scenarioId?: string;
        checklist?: Record<string, boolean>;
      };
      const storedTrackId = parsed.trackId && parsed.trackId in demoWalkthroughTracks ? parsed.trackId : defaultTrackId;
      const storedPersonaId = demoWalkthroughTracks[storedTrackId].personas.some((persona) => persona.id === parsed.personaId)
        ? parsed.personaId!
        : getDefaultPersonaIdForTrack(storedTrackId);
      const storedScenarioId = demoWalkthroughTracks[storedTrackId].scenarios.some((scenario) => scenario.id === parsed.scenarioId)
        ? parsed.scenarioId!
        : getDefaultScenarioIdForTrack(storedTrackId);
      return {
        active: Boolean(parsed.active),
        currentStepIndex: Math.max(0, Math.min(parsed.currentStepIndex ?? 0, demoWalkthroughTracks[storedTrackId].steps.length - 1)),
        trackId: storedTrackId,
        personaId: storedPersonaId,
        scenarioId: storedScenarioId,
        checklist: parsed.checklist ?? {},
      };
    } catch {
      return {
        active: false,
        currentStepIndex: 0,
        trackId: defaultTrackId,
        personaId: getDefaultPersonaIdForTrack(defaultTrackId),
        scenarioId: getDefaultScenarioIdForTrack(defaultTrackId),
        checklist: {},
      };
    }
  });

  const [active, setActive] = useState(initialState.active);
  const [trackId, setTrackId] = useState<DemoTrackId>(initialState.trackId);
  const [personaId, setPersonaId] = useState<string>(initialState.personaId);
  const [scenarioId, setScenarioId] = useState<string>(initialState.scenarioId);
  const [persistedStepIndex, setPersistedStepIndex] = useState(initialState.currentStepIndex);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(initialState.checklist);
  const [rehearsalTargetSeconds, setRehearsalTargetSeconds] = useState<number>(300);
  const [rehearsalStartedAt, setRehearsalStartedAt] = useState<number | null>(null);
  const [rehearsalAccumulatedSeconds, setRehearsalAccumulatedSeconds] = useState(0);

  const track = demoWalkthroughTracks[trackId];
  const persona = track.personas.find((candidate) => candidate.id === personaId) ?? track.personas[0];
  const scenario = track.scenarios.find((candidate) => candidate.id === scenarioId) ?? track.scenarios[0];
  const pathStepIndex = getWalkthroughStepIndex(pathname, trackId);
  const currentStepIndex = active && pathStepIndex >= 0 ? pathStepIndex : persistedStepIndex;
  const currentStep = track.steps[currentStepIndex];
  const onStepPath = pathname === currentStep?.path;
  const isRehearsalRunning = rehearsalStartedAt !== null;
  const rehearsalElapsedSeconds = rehearsalAccumulatedSeconds + (isRehearsalRunning ? Math.floor((now - rehearsalStartedAt) / 1000) : 0);
  const currentStepTargetSeconds = getStepTargetSeconds(trackId, rehearsalTargetSeconds, currentStepIndex);
  const expectedElapsedSeconds = getExpectedElapsedSeconds(trackId, rehearsalTargetSeconds, currentStepIndex);
  const rehearsalDeltaSeconds = rehearsalElapsedSeconds - expectedElapsedSeconds;
  const rehearsalRemainingSeconds = Math.max(rehearsalTargetSeconds - rehearsalElapsedSeconds, 0);
  const checklistKeyPrefix = `${trackId}:${scenarioId}:`;
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.origin + pathname);
    url.searchParams.set("demo", "1");
    url.searchParams.set("track", trackId);
    url.searchParams.set("persona", personaId);
    url.searchParams.set("scenario", scenarioId);
    return url.toString();
  }, [pathname, personaId, scenarioId, trackId]);

  useEffect(() => {
    if (!searchParams.get("demo")) return;
    const nextTrack = searchParams.get("track") as DemoTrackId | null;
    const nextPersona = searchParams.get("persona");
    const nextScenario = searchParams.get("scenario");

    if (nextTrack && nextTrack in demoWalkthroughTracks) {
      setTrackId(nextTrack);
      setPersonaId(
        demoWalkthroughTracks[nextTrack].personas.some((personaOption) => personaOption.id === nextPersona)
          ? nextPersona!
          : getDefaultPersonaIdForTrack(nextTrack),
      );
      setScenarioId(
        demoWalkthroughTracks[nextTrack].scenarios.some((scenarioOption) => scenarioOption.id === nextScenario)
          ? nextScenario!
          : getDefaultScenarioIdForTrack(nextTrack),
      );
      setActive(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ active, currentStepIndex, trackId, personaId, scenarioId, checklist }),
    );
  }, [active, checklist, currentStepIndex, personaId, scenarioId, trackId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));
  }, [analytics]);

  useEffect(() => {
    if (!isRehearsalRunning) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [isRehearsalRunning]);

  useEffect(() => {
    if (!isAudioEnabled || !active || !currentStep) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(
      `${currentStep.title}. Presenter note. ${currentStep.presenterNote}. Talking points. ${currentStep.talkingPoints.join(". ")}`,
    );
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [active, currentStep, isAudioEnabled]);

  const bumpAnalytics = (kind: "track" | "scenario" | "export" | "recap") => {
    setAnalytics((current) => {
      if (kind === "export") return { ...current, exports: current.exports + 1 };
      if (kind === "recap") return { ...current, recapVisits: current.recapVisits + 1 };
      if (kind === "track") {
        return {
          ...current,
          startsByTrack: {
            ...current.startsByTrack,
            [trackId]: (current.startsByTrack[trackId] ?? 0) + 1,
          },
        };
      }
      return {
        ...current,
        startsByScenario: {
          ...current.startsByScenario,
          [scenarioId]: (current.startsByScenario[scenarioId] ?? 0) + 1,
        },
      };
    });
  };

  const startWalkthrough = () => {
    setActive(true);
    setPersistedStepIndex(0);
    bumpAnalytics("track");
    bumpAnalytics("scenario");
    router.push(track.steps[0].path);
  };

  const stopWalkthrough = () => {
    setActive(false);
    setPersistedStepIndex(0);
    setRehearsalStartedAt(null);
    setIsAudioEnabled(false);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const goToNext = () => {
    if (currentStepIndex >= track.steps.length - 1) {
      stopWalkthrough();
      return;
    }
    const nextIndex = currentStepIndex + 1;
    setPersistedStepIndex(nextIndex);
    router.push(track.steps[nextIndex].path);
  };

  const goToPrevious = () => {
    if (currentStepIndex <= 0) {
      router.push(track.steps[0].path);
      return;
    }
    const previousIndex = currentStepIndex - 1;
    setPersistedStepIndex(previousIndex);
    router.push(track.steps[previousIndex].path);
  };

  const handleTrackChange = (nextTrackId: DemoTrackId) => {
    setTrackId(nextTrackId);
    setPersonaId(getDefaultPersonaIdForTrack(nextTrackId));
    setScenarioId(getDefaultScenarioIdForTrack(nextTrackId));
    setPersistedStepIndex(0);
    setChecklist({});
    if (active) {
      router.push(demoWalkthroughTracks[nextTrackId].steps[0].path);
    }
  };

  const startRehearsal = (targetSeconds = rehearsalTargetSeconds) => {
    setRehearsalTargetSeconds(targetSeconds);
    setRehearsalAccumulatedSeconds(0);
    setRehearsalStartedAt(Date.now());
    setNow(Date.now());
    if (!active) {
      startWalkthrough();
    }
  };

  const toggleRehearsal = () => {
    if (isRehearsalRunning) {
      setRehearsalAccumulatedSeconds(rehearsalElapsedSeconds);
      setRehearsalStartedAt(null);
      return;
    }
    setRehearsalStartedAt(Date.now());
    setNow(Date.now());
  };

  const resetRehearsal = () => {
    setRehearsalAccumulatedSeconds(0);
    setRehearsalStartedAt(null);
    setNow(Date.now());
  };

  const resetDemoState = () => {
    setActive(false);
    setTrackId(defaultTrackId);
    setPersonaId(getDefaultPersonaIdForTrack(defaultTrackId));
    setScenarioId(getDefaultScenarioIdForTrack(defaultTrackId));
    setPersistedStepIndex(0);
    setChecklist({});
    resetRehearsal();
    setIsAudioEnabled(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    toast.success("Demo state reset", {
      description: "Walkthrough, rehearsal, and scenario selections were cleared for a fresh run.",
    });
  };

  const exportBrief = () => {
    startExportTransition(async () => {
      try {
        const response = await fetch("/api/v1/demo/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId, personaId }),
        });
        if (!response.ok) throw new Error("Export failed");
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        const match = response.headers.get("Content-Disposition")?.match(/filename="(.+)"/);
        anchor.href = url;
        anchor.download = match?.[1] ?? `demo_brief_${trackId}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
        bumpAnalytics("export");
        toast.success("Demo brief exported", {
          description: `Downloaded the ${track.label.toLowerCase()} walkthrough brief for ${persona.label}.`,
        });
      } catch {
        toast.error("Export failed", {
          description: "Could not generate the walkthrough PDF right now.",
        });
      }
    });
  };

  const copyShareLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied", {
      description: "The active track, persona, and scenario are now encoded in the link.",
    });
  };

  const copyFollowUpDraft = async () => {
    const draft = `${scenario.followUpSubject}\n\n${scenario.followUpBody}\n\nKey scenario: ${scenario.label}\nPersona: ${persona.label}\nTrack: ${track.label}`;
    await navigator.clipboard.writeText(draft);
    toast.success("Follow-up draft copied", {
      description: "You can paste the post-demo recap into email or notes.",
    });
  };

  const toggleChecklistItem = (item: string) => {
    const key = `${checklistKeyPrefix}${item}`;
    setChecklist((current) => ({ ...current, [key]: !current[key] }));
  };

  const openRecapPage = () => {
    bumpAnalytics("recap");
    router.push(`/demo-recap?track=${trackId}&persona=${personaId}&scenario=${scenarioId}`);
  };

  const value: WalkthroughContextValue = {
    active,
    trackId,
    personaId,
    scenarioId,
    currentStepIndex,
    shareUrl,
    analytics,
    checklist,
    startWalkthrough,
    stopWalkthrough,
    goToNext,
    goToPrevious,
    setTrackId: handleTrackChange,
    setPersonaId,
    setScenarioId,
    resetDemoState,
  };

  return (
    <WalkthroughContext.Provider value={value}>
      {children}
      {active && currentStep ? (
        <div className="pointer-events-none fixed bottom-5 right-5 z-50 w-[min(460px,calc(100vw-2rem))]">
          <div className="pointer-events-auto overflow-hidden rounded-2xl border border-cyan-500/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.1),rgba(9,9,11,0.96)_35%)] shadow-[0_24px_80px_-24px_rgba(8,145,178,0.45)]">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/80">{currentStep.eyebrow}</div>
                  <h2 className="mt-2 text-lg font-semibold text-zinc-50">{currentStep.title}</h2>
                  <p className="mt-1 text-xs text-zinc-400">{track.description}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-500 hover:bg-white/10 hover:text-zinc-200" onClick={stopWalkthrough} aria-label="End walkthrough">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {Object.values(demoWalkthroughTracks).map((candidateTrack) => (
                  <Button
                    key={candidateTrack.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleTrackChange(candidateTrack.id)}
                    className={cn("h-8 rounded-full border-white/10 bg-white/5 text-xs text-zinc-300 hover:bg-white/10", trackId === candidateTrack.id && "border-cyan-500/25 bg-cyan-500/10 text-cyan-200")}
                  >
                    <Users className="mr-2 h-3.5 w-3.5" />
                    {candidateTrack.label}
                  </Button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {track.personas.map((candidatePersona) => (
                  <Button
                    key={candidatePersona.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPersonaId(candidatePersona.id)}
                    className={cn("h-8 rounded-full border-white/10 bg-white/5 text-xs text-zinc-300 hover:bg-white/10", persona.id === candidatePersona.id && "border-emerald-500/25 bg-emerald-500/10 text-emerald-200")}
                  >
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                    {candidatePersona.label}
                  </Button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {track.scenarios.map((candidateScenario) => (
                  <Button
                    key={candidateScenario.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setScenarioId(candidateScenario.id)}
                    className={cn("h-8 rounded-full border-white/10 bg-white/5 text-xs text-zinc-300 hover:bg-white/10", scenario.id === candidateScenario.id && "border-rose-500/25 bg-rose-500/10 text-rose-200")}
                  >
                    <Flag className="mr-2 h-3.5 w-3.5" />
                    {candidateScenario.label}
                  </Button>
                ))}
              </div>

              <div className="mt-3 rounded-xl border border-amber-500/15 bg-amber-500/8 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-amber-300/80">Rehearsal Mode</div>
                    <div className="mt-1 text-sm text-zinc-100">{isRehearsalRunning ? "Live practice timer running" : rehearsalElapsedSeconds > 0 ? "Paused rehearsal timer" : "Choose a target run time"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {REHEARSAL_PRESETS.map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => startRehearsal(preset)}
                        className={cn("h-8 rounded-full border-white/10 bg-white/5 text-xs text-zinc-300 hover:bg-white/10", rehearsalTargetSeconds === preset && "border-amber-500/25 bg-amber-500/10 text-amber-200")}
                      >
                        {preset / 60} min
                      </Button>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={toggleRehearsal} className="h-8 rounded-full border-white/10 bg-white/5 text-xs text-zinc-300 hover:bg-white/10">
                      {isRehearsalRunning ? <PauseCircle className="mr-2 h-3.5 w-3.5" /> : <PlayCircle className="mr-2 h-3.5 w-3.5" />}
                      {isRehearsalRunning ? "Pause" : rehearsalElapsedSeconds > 0 ? "Resume" : "Start"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={resetRehearsal} className="h-8 rounded-full border-white/10 bg-white/5 text-xs text-zinc-300 hover:bg-white/10">
                      <TimerReset className="mr-2 h-3.5 w-3.5" />
                      Reset
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsAudioEnabled((current) => !current)} className="h-8 rounded-full border-white/10 bg-white/5 text-xs text-zinc-300 hover:bg-white/10">
                      {isAudioEnabled ? <VolumeX className="mr-2 h-3.5 w-3.5" /> : <Volume2 className="mr-2 h-3.5 w-3.5" />}
                      {isAudioEnabled ? "Mute notes" : "Speaker notes"}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Elapsed</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-100">{formatSeconds(rehearsalElapsedSeconds)}</div>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Remaining</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-100">{formatSeconds(rehearsalRemainingSeconds)}</div>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Step Target</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-100">{formatSeconds(currentStepTargetSeconds)}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-zinc-300">
                  {rehearsalDeltaSeconds > 15
                    ? `You are running ${formatSeconds(rehearsalDeltaSeconds)} over pace.`
                    : rehearsalDeltaSeconds < -15
                      ? `You are ${formatSeconds(Math.abs(rehearsalDeltaSeconds))} ahead of pace.`
                      : "You are on pace for this walkthrough target."}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                {track.steps.map((step, index) => (
                  <div key={step.id} className={cn("h-1.5 flex-1 rounded-full transition-colors", index <= currentStepIndex ? "bg-cyan-400" : "bg-white/10")} />
                ))}
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/8 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-cyan-500/20 bg-cyan-500/10 text-cyan-200">{persona.label}</Badge>
                  <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{persona.featuredClient}</Badge>
                </div>
                <p className="mt-3 text-sm text-zinc-200">{persona.scenario}</p>
                <p className="mt-2 text-xs leading-5 text-cyan-100/80">{persona.whyItWins}</p>
              </div>

              <div className="mt-4 rounded-xl border border-rose-500/15 bg-rose-500/8 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-rose-500/20 bg-rose-500/10 text-rose-200">Scenario Engine</Badge>
                  <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{scenario.label}</Badge>
                </div>
                <p className="mt-3 text-sm text-zinc-200">{scenario.hook}</p>
                <p className="mt-2 text-xs leading-5 text-rose-100/80">{scenario.operatorFocus}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-xs text-zinc-300">
                    <span className="font-semibold text-zinc-100">Success signal:</span> {scenario.successSignal}
                  </div>
                  <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-xs text-zinc-300">
                    <span className="font-semibold text-zinc-100">Must-show:</span> {scenario.mustShow.join(", ")}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-emerald-500/15 bg-emerald-500/8 p-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">
                  <Flag className="h-3.5 w-3.5" />
                  Presenter Note
                </div>
                <p className="mt-2 text-sm text-emerald-100">{currentStep.presenterNote}</p>
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-200">{currentStep.summary}</p>

              <div className="mt-4 space-y-2">
                {currentStep.talkingPoints.map((point) => (
                  <div key={point} className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 text-sm text-zinc-300">
                    {point}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Scenario Objections</div>
                <div className="mt-3 space-y-3">
                  {scenario.objections.map((objection) => (
                    <div key={objection.question} className="rounded-lg border border-white/8 bg-black/20 p-3">
                      <div className="text-sm font-medium text-zinc-100">{objection.question}</div>
                      <p className="mt-2 text-xs leading-5 text-zinc-400">{objection.answer}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Confidence Checklist</div>
                <div className="mt-3 space-y-2">
                  {scenario.mustShow.map((item) => {
                    const checked = checklist[`${checklistKeyPrefix}${item}`] ?? false;
                    return (
                      <button key={item} type="button" onClick={() => toggleChecklistItem(item)} className="flex w-full items-center gap-2 rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-left text-sm text-zinc-300">
                        {checked ? <CheckSquare className="h-4 w-4 text-emerald-300" /> : <Square className="h-4 w-4 text-zinc-500" />}
                        <span>{item}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={onStepPath ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}>
                  {onStepPath ? "On the right screen" : "Navigate to this step"}
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{track.label} track</Badge>
                {!onStepPath ? (
                  <Link href={currentStep.path} className="text-xs font-medium text-cyan-300 transition-colors hover:text-cyan-200">
                    Open {currentStep.title.toLowerCase()}
                  </Link>
                ) : null}
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Analytics</div>
                  <div className="mt-2 text-xs text-zinc-300">Track starts: {analytics.startsByTrack[trackId] ?? 0}</div>
                  <div className="mt-1 text-xs text-zinc-300">Scenario starts: {analytics.startsByScenario[scenarioId] ?? 0}</div>
                  <div className="mt-1 text-xs text-zinc-300">Brief exports: {analytics.exports}</div>
                  <div className="mt-1 text-xs text-zinc-300">Recap opens: {analytics.recapVisits}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Scenario KPIs</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {scenario.pinnedKpis.map((kpi) => (
                      <Badge key={kpi} variant="outline" className="border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                        {kpi}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
              <Button type="button" variant="outline" size="sm" onClick={goToPrevious} className="border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={copyShareLink} className="border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10">
                  <Link2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={copyFollowUpDraft} className="border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10">
                  <Copy className="mr-2 h-4 w-4" />
                  Follow-Up
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={openRecapPage} className="border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10">
                  Recap
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={exportBrief} disabled={isExporting} className="border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10">
                  <Download className="mr-2 h-4 w-4" />
                  {isExporting ? "Exporting..." : "Export Brief"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={resetDemoState} className="border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10">
                  Reset Demo
                </Button>
                <div className="text-xs text-zinc-500">{currentStepIndex + 1} / {track.steps.length}</div>
              </div>
              <Button type="button" size="sm" onClick={goToNext} className="bg-cyan-500 text-zinc-950 hover:bg-cyan-400">
                {currentStep.ctaLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </WalkthroughContext.Provider>
  );
}

export function useDemoWalkthrough() {
  const context = useContext(WalkthroughContext);
  if (!context) {
    throw new Error("useDemoWalkthrough must be used within DemoWalkthroughProvider.");
  }
  return context;
}

export function DemoWalkthroughTrigger() {
  const { active, trackId, personaId, startWalkthrough, stopWalkthrough } = useDemoWalkthrough();
  const label = demoWalkthroughTracks[trackId].label;
  const persona = demoWalkthroughTracks[trackId].personas.find((candidate) => candidate.id === personaId);

  return (
    <Button type="button" size="sm" variant={active ? "outline" : "default"} onClick={active ? stopWalkthrough : startWalkthrough} className={active ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15" : "bg-cyan-500 text-zinc-950 hover:bg-cyan-400"}>
      <PlayCircle className="mr-2 h-4 w-4" />
      {active ? `End ${label} Walkthrough` : `Start ${label}${persona ? `: ${persona.label}` : ""}`}
    </Button>
  );
}
