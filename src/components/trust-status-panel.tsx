"use client";

import { Badge } from "@/components/ui/badge";
import type { TrustStatusItem, TrustTone } from "@/lib/trust-status";

const toneStyles: Record<TrustTone, string> = {
  emerald: "border-black/6 bg-white/56 text-zinc-700 dark:border-white/8 dark:bg-white/[0.04] dark:text-zinc-300",
  amber: "border-amber-500/16 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300",
  rose: "border-rose-500/16 bg-rose-500/[0.06] text-rose-700 dark:text-rose-300",
  zinc: "border-black/6 bg-white/56 text-zinc-700 dark:border-white/8 dark:bg-white/[0.04] dark:text-zinc-300",
};

export function TrustStatusPanel({
  eyebrow,
  title,
  description,
  modeLabel,
  modeDetail,
  modeTone,
  items,
}: {
  eyebrow: string;
  title: string;
  description: string;
  modeLabel: string;
  modeDetail: string;
  modeTone: TrustTone;
  items: TrustStatusItem[];
}) {
  return (
    <div className="rounded-[28px] border border-black/6 bg-white/52 p-5 shadow-[0_20px_60px_-36px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.84)] backdrop-blur-2xl dark:border-white/8 dark:bg-white/[0.04] dark:shadow-[0_20px_60px_-38px_rgba(0,0,0,0.76),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{eyebrow}</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">{title}</h2>
            <Badge variant="outline" className={toneStyles[modeTone]}>{modeLabel}</Badge>
          </div>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{description}</p>
          <p className="mt-2 text-xs text-zinc-500">{modeDetail}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className={`rounded-xl border p-4 ${toneStyles[item.tone]}`}>
            <div className="text-[11px] uppercase tracking-[0.18em] opacity-80">{item.label}</div>
            <div className="mt-2 text-xl font-semibold">{item.value}</div>
            <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
