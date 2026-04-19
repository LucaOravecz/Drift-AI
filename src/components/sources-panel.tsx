"use client";
import { useState } from "react";
import { Copy, FileText, ChevronDown, Check, Building, LayoutTemplate, Scale, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CopilotSource } from "@/lib/services/copilot.service";

const SOURCE_ICONS: Record<CopilotSource["kind"], React.ComponentType<{ className?: string }>> = {
  document: FileText,
  client: Building,
  meeting: LayoutTemplate,
  custodian_position: LayoutTemplate,
  compliance_rule: Scale,
  web: Globe,
};

export function SourcesPanel({ sources }: { sources: CopilotSource[] | undefined }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!sources || sources.length === 0) return null;

  const validSources = sources.filter(s => s.confidence && s.confidence >= 0.3).slice(0, 10);
  if (validSources.length === 0) return null;

  const handleCopy = () => {
    const biblio = validSources.map((s, i) => `[${i + 1}] ${s.label}${s.subtitle ? ` (${s.subtitle})` : ""}`).join("\n");
    navigator.clipboard.writeText(biblio);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted transition-colors text-xs font-medium text-foreground"
      >
        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
        Sources <span className="text-muted-foreground">·</span> {validSources.length}
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ml-1", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="mt-4 rounded-xl border border-border bg-card overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
            <h4 className="text-sm font-semibold text-foreground">Grounded Sources</h4>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={handleCopy}>
              {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copied ? "Copied" : "Copy citations"}
            </Button>
          </div>
          <div className="p-4 space-y-4 max-h-[320px] overflow-y-auto">
            {validSources.map((source, i) => {
              const Icon = SOURCE_ICONS[source.kind] || FileText;
              return (
                <div key={source.id} className="relative flex gap-4">
                  {i < validSources.length - 1 && (
                    <div className="absolute left-[13px] top-7 bottom-[-24px] w-[1px] bg-border" />
                  )}
                  <div className="relative z-10 flex w-7 h-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col flex-1 pb-1">
                    <div className="flex items-baseline justify-between gap-4">
                      <h5 className="text-sm font-medium text-foreground tracking-tight leading-none pt-1">
                        {source.label}
                      </h5>
                    </div>
                    {source.subtitle && (
                      <p className="text-xs text-muted-foreground mt-1.5 leading-none">
                        {source.subtitle}
                      </p>
                    )}
                    {source.excerpt && (
                      <div className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground/80 bg-muted/30 p-2 rounded-md border border-border/50">
                        &ldquo;{source.excerpt}&rdquo;
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2.5">
                      {source.confidence !== undefined && (
                        <div className="flex items-center gap-1.5">
                          <div className="flex gap-[1px]">
                            {[1, 2, 3].map(level => (
                               <div key={level} className={cn("w-3 h-1 rounded-sm", source.confidence! >= (level * 0.3) ? "bg-emerald-500" : "bg-muted")} />
                            ))}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Conf</span>
                        </div>
                      )}
                      {source.freshness && (
                        <span className="text-[11px] text-muted-foreground border border-border px-1.5 rounded-sm">
                          {new Date(source.freshness).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
