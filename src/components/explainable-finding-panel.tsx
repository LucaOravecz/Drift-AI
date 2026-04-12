"use client";

import type { ExplainableFinding } from "@/lib/findings";

export function ExplainableFindingPanel({
  finding,
  fallbackEvidence,
  className = "",
}: {
  finding: ExplainableFinding | null;
  fallbackEvidence?: string | null;
  className?: string;
}) {
  if (!finding && !fallbackEvidence) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      {finding ? (
        <>
          <TraceBlock label="Trigger" value={finding.trigger} />
          <TraceList label="Evidence" values={finding.evidence} />
          <TraceBlock label="Why It Matters" value={finding.whyItMatters} />
          <TraceBlock label="If Ignored" value={finding.consequenceIfIgnored} />
          <TraceBlock label="Next Best Action" value={finding.nextBestAction} />
          <TraceBlock label="Confidence" value={finding.confidence} />
          {finding.missingData.length > 0 ? (
            <TraceList label="Missing Data" values={finding.missingData} tone="warn" />
          ) : null}
        </>
      ) : null}

      {!finding && fallbackEvidence ? <TraceBlock label="Evidence" value={fallbackEvidence} /> : null}
    </div>
  );
}

function TraceBlock({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  return (
    <div className="border-l-2 border-white/10 pl-3">
      <div className={`text-[10px] font-mono uppercase tracking-wider ${tone === "warn" ? "text-amber-500/80" : "text-zinc-600"}`}>
        {label}
      </div>
      <div className={`mt-1 text-xs leading-relaxed ${tone === "warn" ? "text-amber-500/80" : "text-zinc-400"}`}>{value}</div>
    </div>
  );
}

function TraceList({
  label,
  values,
  tone = "default",
}: {
  label: string;
  values: string[];
  tone?: "default" | "warn";
}) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className="border-l-2 border-white/10 pl-3">
      <div className={`text-[10px] font-mono uppercase tracking-wider ${tone === "warn" ? "text-amber-500/80" : "text-zinc-600"}`}>
        {label}
      </div>
      <div className="mt-1 space-y-1">
        {values.map((value) => (
          <div
            key={`${label}-${value}`}
            className={`text-xs leading-relaxed ${tone === "warn" ? "text-amber-500/80" : "text-zinc-400"}`}
          >
            {value}
          </div>
        ))}
      </div>
    </div>
  );
}
