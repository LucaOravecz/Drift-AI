import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight, Download, ShieldCheck, Sparkles, TrendingUp, Users } from "lucide-react";
import type { RenewalReadinessService } from "@/lib/services/renewal-readiness.service";

type Tone = "emerald" | "cyan" | "amber" | "rose";

function toneClasses(tone: Tone) {
  if (tone === "emerald") return "border-emerald-500/20 bg-emerald-500/8 text-emerald-200";
  if (tone === "cyan") return "border-cyan-500/20 bg-cyan-500/8 text-cyan-200";
  if (tone === "amber") return "border-amber-500/20 bg-amber-500/8 text-amber-200";
  return "border-rose-500/20 bg-rose-500/8 text-rose-200";
}

export function RenewalReadinessClient({
  center,
}: {
  center: Awaited<ReturnType<typeof RenewalReadinessService.getCenter>>;
}) {
  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-8 pb-16">
      <div className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(8,17,26,0.96),rgba(9,9,11,0.92)_55%,rgba(21,94,117,0.2))] p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-cyan-300/80">
              <Sparkles className="h-3.5 w-3.5" />
              Renewal Story
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-50">{center.headline}</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{center.subheadline}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/75">Firm score</div>
              <div className="mt-2 text-4xl font-semibold text-emerald-200">{center.overallScore}</div>
            </div>
            <Link href="/api/v1/dashboard/roi-report" target="_blank" className={buttonVariants({ variant: "outline", size: "sm", className: "border-cyan-500/20 bg-cyan-500/5 text-cyan-200 hover:bg-cyan-500/10" })}>
              <Download className="mr-2 h-4 w-4" />
              ROI PDF
            </Link>
            <Link href="/" className={buttonVariants({ size: "sm", className: "bg-emerald-600 text-white hover:bg-emerald-500" })}>
              Back to dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {center.summaryCards.map((card) => (
          <div key={card.label} className={`rounded-2xl border p-5 ${toneClasses(card.tone)}`}>
            <div className="text-[11px] uppercase tracking-[0.18em] opacity-80">{card.label}</div>
            <div className="mt-3 text-3xl font-semibold">{card.value}</div>
            <p className="mt-3 text-xs leading-5 opacity-80">{card.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
            <Users className="h-4 w-4" />
            Advisor And Team Readiness
          </div>
          <div className="mt-5 space-y-3">
            {center.advisors.map((advisor) => (
              <div key={advisor.id} className="rounded-xl border border-white/8 bg-black/20 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-base font-medium text-zinc-100">{advisor.name}</div>
                      <Badge variant="outline" className={`text-[11px] ${toneClasses(advisor.readinessTone)}`}>
                        {advisor.readinessScore}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">{advisor.role} • Last seen {advisor.lastSeen}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-right text-xs text-zinc-400">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Completed</div>
                      <div className="mt-1 text-lg font-semibold text-zinc-100">{advisor.completedTasks}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Open</div>
                      <div className="mt-1 text-lg font-semibold text-zinc-100">{advisor.openTasks}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">AI assists</div>
                      <div className="mt-1 text-lg font-semibold text-zinc-100">{advisor.aiAssists}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-6">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
              <ShieldCheck className="h-4 w-4" />
              Role Coverage
            </div>
            <div className="mt-4 space-y-3">
              {center.roleCards.map((role) => (
                <div key={role.role} className="rounded-xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-zinc-100">{role.role}</div>
                    <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-300">
                      {role.count} seats
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">{role.activeInLast14Days} active in the last 14 days.</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-6">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
              <TrendingUp className="h-4 w-4" />
              Renewal Talking Points
            </div>
            <div className="mt-4 space-y-3">
              {center.renewalTalkingPoints.map((point) => (
                <div key={point} className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 text-sm leading-6 text-zinc-200">
                  {point}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Client Segment ROI</div>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-50">Where the product is proving itself</h2>
          </div>
          <Badge variant="outline" className="border-cyan-500/20 bg-cyan-500/5 text-cyan-300">
            Segment by client type
          </Badge>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {center.clientSegments.map((segment) => (
            <div key={segment.label} className="rounded-2xl border border-white/8 bg-black/20 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-zinc-100">{segment.label}</div>
                  <div className="mt-1 text-xs text-zinc-500">{segment.count} clients • {segment.aumLabel} book value</div>
                </div>
                <Badge variant="outline" className={toneClasses(segment.tone)}>
                  {segment.readinessScore}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/8 bg-zinc-950/60 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Pipeline</div>
                  <div className="mt-2 text-xl font-semibold text-zinc-100">{segment.pipelineLabel}</div>
                </div>
                <div className="rounded-xl border border-white/8 bg-zinc-950/60 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Recent touch</div>
                  <div className="mt-2 text-xl font-semibold text-zinc-100">{segment.coverage}%</div>
                </div>
                <div className="rounded-xl border border-white/8 bg-zinc-950/60 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Brief coverage</div>
                  <div className="mt-2 text-xl font-semibold text-zinc-100">{segment.briefCoverage}%</div>
                </div>
                <div className="rounded-xl border border-white/8 bg-zinc-950/60 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">High churn</div>
                  <div className="mt-2 text-xl font-semibold text-zinc-100">{segment.churnRisk}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
