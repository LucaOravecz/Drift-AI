"use client";
import { Check, Loader2, FileText, Search, ShieldCheck, Database, Sparkles, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepState = "pending" | "active" | "done";
export type StepKind = "classify" | "gather_context" | "check_rules" | "search_web"
              | "read_vault" | "compliance" | "synthesize" | "cite";

const ICONS: Record<StepKind, React.ComponentType<{ className?: string }>> = {
  classify: Sparkles,
  gather_context: Database,
  check_rules: ShieldCheck,
  search_web: Search,
  read_vault: FileText,
  compliance: ShieldCheck,
  synthesize: Sparkles,
  cite: Quote,
};

export type WorkingStep = {
  id: string;
  kind: StepKind;
  title: string;
  body?: string;
  chips?: string[];
  state: StepState;
};

export function WorkingChain({ steps }: { steps: WorkingStep[] }) {
  if (steps.length === 0) return null;

  return (
    <ol className="space-y-4 border-l border-border pl-5 ml-1.5 py-2">
      {steps.map((s) => {
        const Icon = ICONS[s.kind];
        return (
          <li key={s.id} className="relative">
            <span className={cn(
              "absolute -left-[29px] top-0 flex h-5 w-5 items-center justify-center rounded-full border bg-background transition-colors duration-150",
              s.state === "done" && "border-emerald-500/40 text-emerald-500",
              s.state === "active" && "border-brand-400/60 text-brand-400",
              s.state === "pending" && "border-border text-muted-foreground"
            )}>
              {s.state === "done" ? <Check className="h-3 w-3" />
                : s.state === "active" ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Icon className="h-3 w-3" />}
            </span>
            <div className="text-[13px] font-medium text-foreground">{s.title}</div>
            {s.body && (
              <div className="text-[12.5px] text-muted-foreground mt-0.5 animate-in fade-in slide-in-from-left-1 duration-300">
                {s.body}
              </div>
            )}
            {s.chips && s.chips.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5 animate-in fade-in duration-300">
                {s.chips.map((c) => (
                  <span key={c} className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
