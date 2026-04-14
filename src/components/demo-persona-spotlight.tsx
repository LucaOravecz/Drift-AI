"use client";

import { Badge } from "@/components/ui/badge";
import { demoWalkthroughTracks } from "@/lib/demo-walkthrough";
import { useDemoWalkthrough } from "@/components/demo-walkthrough-provider";
import { usePathname } from "next/navigation";
import { Sparkles, Target } from "lucide-react";

export function DemoPersonaSpotlight() {
  const pathname = usePathname();
  const { active, trackId, personaId, scenarioId } = useDemoWalkthrough();

  if (!active) return null;

  const track = demoWalkthroughTracks[trackId];
  const persona = track.personas.find((candidate) => candidate.id === personaId);
  const scenario = track.scenarios.find((candidate) => candidate.id === scenarioId);
  if (!persona) return null;

  const isTrackPage = track.steps.some((step) => step.path === pathname);

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(9,9,11,0.88)_38%)] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-cyan-500/25 bg-cyan-500/10 text-cyan-200">
              {track.label} persona
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">
              {persona.label}
            </Badge>
            {scenario ? (
              <Badge variant="outline" className="border-rose-500/20 bg-rose-500/10 text-rose-200">
                {scenario.label}
              </Badge>
            ) : null}
            <Badge variant="outline" className={isTrackPage ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}>
              {isTrackPage ? "Matches active story step" : "Supporting page in story"}
            </Badge>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-cyan-300/80">
            <Sparkles className="h-3.5 w-3.5" />
            Persona Spotlight
          </div>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">{persona.featuredClient}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-200">{persona.scenario}</p>
          <p className="mt-2 text-xs leading-5 text-zinc-400">{persona.whyItWins}</p>
          {scenario ? (
            <div className="mt-4 rounded-xl border border-rose-500/15 bg-rose-500/8 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-rose-200/80">Scenario Hook</div>
              <p className="mt-2 text-sm text-zinc-200">{scenario.hook}</p>
              <p className="mt-2 text-xs text-zinc-400">{scenario.operatorFocus}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/8 p-4 lg:max-w-sm">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">
            <Target className="h-3.5 w-3.5" />
            Proof Points
          </div>
          <div className="mt-3 space-y-2">
            {persona.proofPoints.map((point) => (
              <div key={point} className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-xs text-zinc-300">
                {point}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
