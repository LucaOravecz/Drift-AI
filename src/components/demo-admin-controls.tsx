"use client";

import { Button } from "@/components/ui/button";
import { useDemoWalkthrough } from "@/components/demo-walkthrough-provider";
import { RefreshCcw } from "lucide-react";

export function DemoAdminControls() {
  const { resetDemoState } = useDemoWalkthrough();

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
      <div className="text-sm font-medium text-amber-200">Demo Environment Controls</div>
      <p className="mt-2 text-xs text-zinc-300">
        Use this on local or staging environments to clear walkthrough, rehearsal, checklist, and scenario state before a fresh client session.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={resetDemoState} className="mt-3 border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10">
        <RefreshCcw className="mr-2 h-4 w-4" />
        Reset demo state
      </Button>
    </div>
  );
}
