"use client";

import { useState, useMemo } from "react";
import { Copy, Check, X, FileDown, AlertTriangle, Info, Scale, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Suggestion = {
  id: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  category: "compliance" | "clarity" | "accuracy" | "tone" | "missing_disclosure";
  severity: "low" | "med" | "high";
  citations?: { source: string; url?: string }[];
};

export function DocumentReviewer({ 
  documentId, 
  rawText, 
  summary,
  severity: overallSeverity,
  suggestions 
}: { 
  documentId: string;
  rawText: string;
  summary: string;
  severity: string;
  suggestions: Suggestion[];
}) {
  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Split text to inject spans around originalText
  const htmlDoc = useMemo(() => {
    let html = rawText;
    suggestions.forEach(s => {
      if (applied.has(s.id) || dismissed.has(s.id)) return;
      if (html.includes(s.originalText)) {
        html = html.replace(s.originalText, `<span class="bg-brand-500/20 border-b-2 border-brand-500/50 cursor-pointer transition-colors hover:bg-brand-500/30" data-sugg-id="${s.id}">${s.originalText}</span>`);
      }
    });

    // Replace applied suggestions
    suggestions.forEach(s => {
      if (applied.has(s.id)) {
        html = html.replace(s.originalText, `<span class="bg-emerald-500/20 border-b-2 border-emerald-500/50 text-emerald-800">${s.suggestedText}</span>`);
      }
    });
    return html;
  }, [rawText, suggestions, applied, dismissed]);

  const handleApply = (id: string) => {
    setApplied(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleDismiss = (id: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const remaining = suggestions.filter(s => !applied.has(s.id) && !dismissed.has(s.id));

  const handleApplyAll = () => {
    const allRemaining = new Set(remaining.map(s => s.id));
    setApplied(prev => {
      const next = new Set(prev);
      allRemaining.forEach(id => next.add(id));
      return next;
    });
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* Left 60%: Document Window */}
      <div className="w-[60%] border-r border-border bg-card flex flex-col">
        <div className="px-6 py-4 border-b border-border bg-muted/20 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-heading font-semibold">Document Review</h2>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2 max-w-xl">{summary}</p>
          </div>
          <div className="flex items-center gap-3">
             <Badge variant={overallSeverity === "high" ? "destructive" : "secondary"}>
                {overallSeverity.toUpperCase()} RISK
             </Badge>
             {remaining.length > 0 && (
               <Button variant="outline" size="sm" onClick={handleApplyAll}>
                 <Check className="w-4 h-4 mr-2" /> Apply all ({remaining.length})
               </Button>
             )}
             <Button variant="outline" size="sm" onClick={() => alert("Exported DOCX")}>
               <FileDown className="w-4 h-4 mr-2" /> Export DOCX
             </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-12 custom-scrollbar">
          <div 
            className="prose prose-sm max-w-none whitespace-pre-wrap font-serif leading-loose"
            onMouseOver={(e) => {
              const target = e.target as HTMLElement;
              const id = target.getAttribute("data-sugg-id");
              if (id) setActiveSuggestion(id);
            }}
            onMouseOut={() => setActiveSuggestion(null)}
            dangerouslySetInnerHTML={{ __html: htmlDoc }}
          />
        </div>
      </div>

      {/* Right 40%: Suggestions Panel */}
      <div className="w-[40%] bg-muted/10 flex flex-col">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Scale className="w-4 h-4" /> Recommended Edits
            </h3>
            <span className="text-xs text-muted-foreground font-medium">{remaining.length} remaining</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-4 custom-scrollbar">
          {remaining.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Check className="w-12 h-12 mb-4 text-emerald-500/50" />
              <p>All review findings addressed.</p>
            </div>
          )}
          {remaining.map(s => (
            <div 
              key={s.id} 
              id={`sugg-${s.id}`}
              className={cn(
                "rounded-xl border bg-card p-5 transition-shadow duration-200",
                activeSuggestion === s.id ? "border-brand-500 shadow-md ring-1 ring-brand-500/20" : "border-border shadow-sm",
                s.severity === "high" && "border-l-4 border-l-red-500"
              )}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                   {s.category === "compliance" || s.category === "missing_disclosure" ? (
                     <ShieldAlert className="w-4 h-4 text-amber-500" />
                   ) : (
                     <Info className="w-4 h-4 text-blue-500" />
                   )}
                   <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                     {s.category.replace("_", " ")}
                   </span>
                </div>
                <Badge variant={s.severity === "high" ? "destructive" : "secondary"} className="text-[10px] uppercase">
                  {s.severity}
                </Badge>
              </div>

              <div className="bg-muted/50 rounded-md p-3 mb-4 text-sm font-medium space-y-2 border border-border">
                <div className="text-red-500 line-through opacity-80">{s.originalText}</div>
                {s.suggestedText && (
                  <div className="text-emerald-600 underline underline-offset-2">{s.suggestedText}</div>
                )}
              </div>

              <p className="text-sm text-foreground leading-relaxed mb-4">
                {s.reason}
              </p>

              {s.citations && s.citations.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {s.citations.map((c, i) => (
                    <span key={i} className="text-[11px] text-muted-foreground bg-muted px-2 py-1 rounded-sm flex items-center gap-1">
                      <Scale className="w-3 h-3" /> {c.source}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => handleApply(s.id)}>
                  <Check className="w-4 h-4 mr-1.5" /> Apply
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const text = s.suggestedText
                    ? `${s.originalText} → ${s.suggestedText} (${s.reason})`
                    : `Remove: ${s.originalText} (${s.reason})`;
                  navigator.clipboard.writeText(text);
                }}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDismiss(s.id)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
