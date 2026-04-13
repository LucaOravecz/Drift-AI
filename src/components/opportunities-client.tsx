"use client";

import * as React from "react";
import { useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, ArrowUpRight, CheckCircle2, XCircle, Loader2, Radar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { approveOpportunity, dismissOpportunity, scanClientOpportunities, generateCommunicationDraft } from "@/lib/actions";
import { toast } from "sonner";
import { parseFinding } from "@/lib/findings";
import { ExplainableFindingPanel } from "@/components/explainable-finding-panel";

interface OpportunityCard {
  id: string;
  clientId: string;
  type: string;
  confidence: number;
  valueEst: number | null;
  evidence: string | null;
  reasoning: string | null;
  suggestedAction: string;
  client: {
    name: string;
  };
}

const reasoningLogs = [
  "Checking contact gaps and overdue reviews.",
  "Looking for blocked onboarding workflows.",
  "Cross-referencing churn and task signals.",
  "Persisting only grounded opportunities.",
];

export function OpportunitiesClient({ opportunities }: { opportunities: OpportunityCard[] }) {
  const [isPending, startTransition] = useTransition();
  const [reasoningStep, setReasoningStep] = React.useState(0);

  React.useEffect(() => {
    if (!isPending) {
      setReasoningStep(0);
      return;
    }
    const interval = setInterval(() => {
      setReasoningStep((s) => (s + 1) % reasoningLogs.length);
    }, 450);
    return () => clearInterval(interval);
  }, [isPending]);

  const handleScan = () => {
    startTransition(async () => {
      try {
        const result = await scanClientOpportunities();
        toast.success("Portfolio scan complete", {
          description: result?.created
            ? `${result.created} grounded opportunity record(s) were created from stored client data.`
            : "No new deterministic opportunities were triggered by current stored data."
        });
      } catch {
        toast.error("Scan failed", {
          description: "The deterministic scan could not complete."
        });
      }
    });
  };

  const handleDraftOutreach = (clientId: string) => {
    startTransition(async () => {
      try {
        await generateCommunicationDraft(clientId, "CHECK_IN"); // Defaulting to check-in for logic
        toast.success("Draft prepared", {
          description: `A personalized outreach draft is now pending approval in the Communications queue.`
        });
      } catch {
        toast.error("Drafting failed", {
          description: "AI engine could not synthesize a compliant draft at this time."
        });
      }
    });
  };

  const handleExecute = (id: string) => {
    startTransition(async () => {
      try {
        const res = await approveOpportunity(id);
        if (res?.success) {
          toast.success("Opportunity executed", {
            description: "Asset gathering workflow initiated. Logged for compliance review."
          });
        } else if (res?.escalated) {
          toast.warning("Institutional escalation", {
            description: res.message
          });
        }
      } catch {
        toast.error("Execution error", {
          description: "Could not approve this opportunity due to security or data integrity rules."
        });
      }
    });
  };

  const handleDismiss = (id: string) => {
    startTransition(async () => {
      try {
        await dismissOpportunity(id);
        toast.info("Opportunity dismissed", {
          description: "Signal removed from active queue and archived for AI model training."
        });
      } catch {
        toast.error("Dismissal failed");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-10 px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white/90">Revenue Engine</h1>
          <p className="text-zinc-400 mt-1">
            Deterministic opportunity records created from stored client data and explicit rules.
          </p>
        </div>
        <Button 
          onClick={handleScan}
          disabled={isPending}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)] backdrop-blur-md transition-all self-start md:self-center"
        >
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radar className="mr-2 h-4 w-4" />}
          {isPending ? "Scanning Stored Data..." : "Run Deterministic Scan"}
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {opportunities.map((opp) => (
            (() => {
              const finding = parseFinding(opp.reasoning);
              return (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
              key={opp.id}
            >
              <Card className="relative overflow-hidden group h-full bg-white/[0.02] border-white/5 shadow-xl flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity">
                  <Target className="h-24 w-24" />
                </div>
                
                <div>
                  <CardHeader className="pb-3 relative z-10">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
                        {opp.type.replace('_', ' ')}
                      </Badge>
                      <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-wider text-primary/80 bg-primary/10 border-none">
                        {opp.confidence}% Match
                      </Badge>
                    </div>
                    <CardTitle className="text-xl mt-4 text-white/90">{opp.client.name}</CardTitle>
                    <CardDescription className="text-lg text-primary font-semibold mt-1">
                      Value: {opp.valueEst ? `$${(opp.valueEst / 1000).toFixed(0)}k` : 'TBD'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="bg-black/40 rounded-lg p-3 border border-white/5 h-full">
                      <p className="text-sm text-zinc-300 leading-relaxed">{finding?.insight ?? opp.suggestedAction}</p>
                      <div className="mt-3">
                        <ExplainableFindingPanel finding={finding} fallbackEvidence={opp.evidence} />
                      </div>
                    </div>
                  </CardContent>
                </div>

                <div className="p-6 pt-0 mt-2 relative z-10 flex flex-col gap-2">
                  <Button 
                    className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-all" 
                    variant="outline"
                    onClick={() => handleDraftOutreach(opp.clientId)}
                    disabled={isPending}
                  >
                    Draft Outreach <ArrowUpRight className="ml-2 h-4 w-4 text-primary" />
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      disabled={isPending}
                      onClick={() => handleExecute(opp.id)}
                      variant="outline" 
                      className="w-full text-xs h-8 bg-primary/10 border-primary/20 hover:bg-primary hover:text-primary-foreground text-primary shadow-[inset_0_1px_0_0_rgba(16,185,129,0.2)] transition-all"
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Execute
                    </Button>
                    <Button 
                      disabled={isPending}
                      onClick={() => handleDismiss(opp.id)}
                      variant="outline" 
                      className="w-full text-xs h-8 bg-white/5 border-white/10 hover:bg-destructive/20 hover:text-destructive hover:border-destructive/50 text-white/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-all"
                    >
                      <XCircle className="mr-1 h-3 w-3" /> Dismiss
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
              );
            })()
          ))}
        </AnimatePresence>

        <motion.div layout>
          <Card className="border-white/5 flex items-center justify-center bg-white/[0.01] border-dashed min-h-[300px] shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            {isPending ? (
              <div className="text-center p-6 max-w-sm flex flex-col items-center relative z-10">
                <div className="flex items-center justify-center mb-6">
                  <Loader2 className="h-8 w-8 text-white/50 animate-spin" />
                </div>
                <h3 className="font-medium text-lg text-white/90">Deep Context Scan...</h3>
                <div className="mt-4 h-6">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={reasoningStep}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="text-[10px] text-primary/70 font-mono uppercase tracking-widest leading-relaxed"
                    >
                      {reasoningLogs[reasoningStep]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 max-w-sm flex flex-col items-center relative z-10">
                <Target className="h-10 w-10 text-white/10 mb-4" />
                <h3 className="font-semibold text-lg text-white/70">Scanning for signals...</h3>
                <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
                  This scan uses only stored records and explicit rules. If no rule fires, no opportunity is created.
                </p>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
