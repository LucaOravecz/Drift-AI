"use client";

import { Badge } from "@/components/ui/badge";
import { demoWalkthroughTracks } from "@/lib/demo-walkthrough";
import { useDemoWalkthrough } from "@/components/demo-walkthrough-provider";

export function DemoHeaderStatus() {
  const { active, trackId, scenarioId } = useDemoWalkthrough();
  if (!active) return null;

  const track = demoWalkthroughTracks[trackId];
  const scenario = track.scenarios.find((candidate) => candidate.id === scenarioId);
  if (!scenario) return null;

  return (
    <div className="hidden xl:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
      <Badge variant="outline" className="border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
        {track.label}
      </Badge>
      <span className="text-xs text-zinc-300">{scenario.label}</span>
      {scenario.pinnedKpis.slice(0, 2).map((kpi) => (
        <Badge key={kpi} variant="outline" className="border-rose-500/20 bg-rose-500/10 text-rose-200">
          {kpi}
        </Badge>
      ))}
    </div>
  );
}
