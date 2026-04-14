"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { demoWalkthroughTracks, type DemoTrackId } from "@/lib/demo-walkthrough";
import { useSearchParams } from "next/navigation";

export function DemoRecapClient() {
  const searchParams = useSearchParams();
  const trackId = (searchParams.get("track") as DemoTrackId | null) ?? "advisor";
  const track = demoWalkthroughTracks[trackId] ?? demoWalkthroughTracks.advisor;
  const persona = track.personas.find((candidate) => candidate.id === searchParams.get("persona")) ?? track.personas[0];
  const scenario = track.scenarios.find((candidate) => candidate.id === searchParams.get("scenario")) ?? track.scenarios[0];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-cyan-500/20 bg-cyan-500/10 text-cyan-200">{track.label}</Badge>
          <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{persona.label}</Badge>
          <Badge variant="outline" className="border-rose-500/20 bg-rose-500/10 text-rose-200">{scenario.label}</Badge>
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-white/90">Client Demo Recap</h1>
        <p className="mt-2 text-sm text-zinc-400">{scenario.hook}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Narrative</div>
          <h2 className="mt-2 text-xl font-semibold text-zinc-100">{persona.featuredClient}</h2>
          <p className="mt-3 text-sm text-zinc-300">{persona.scenario}</p>
          <p className="mt-3 text-sm text-zinc-400">{persona.whyItWins}</p>
          <div className="mt-5 space-y-2">
            {persona.proofPoints.map((point) => (
              <div key={point} className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-sm text-zinc-300">
                {point}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Follow-Up Draft</div>
          <div className="mt-3 rounded-xl border border-white/8 bg-black/20 p-4">
            <div className="text-sm font-medium text-zinc-100">{scenario.followUpSubject}</div>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{scenario.followUpBody}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {scenario.pinnedKpis.map((kpi) => (
              <Badge key={kpi} variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200">
                {kpi}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Walkthrough Sequence</div>
        <div className="mt-4 grid gap-3">
          {track.steps.map((step) => (
            <div key={step.id} className="rounded-xl border border-white/8 bg-black/20 p-4">
              <div className="text-sm font-medium text-zinc-100">{step.title}</div>
              <p className="mt-2 text-sm text-zinc-400">{step.summary}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => window.print()} className="border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10">
          Print recap
        </Button>
      </div>
    </div>
  );
}
