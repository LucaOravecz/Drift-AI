"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, AlertCircle, Loader2, ChevronRight, UserCheck } from "lucide-react";
import { motion } from "framer-motion";
import { advanceOnboardingStep, unblockOnboardingStep, createNewOnboarding } from "@/lib/actions";
import { toast } from "sonner";

const stageColors: Record<string, string> = {
  COMPLETE: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  ACCOUNT_SETUP: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  PROPOSAL: "text-primary bg-primary/10 border-primary/20",
  DOCS_REQUESTED: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  DOCS_RECEIVED: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  DISCOVERY: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
  LEAD: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

function StepIcon({ status }: { status: string }) {
  if (status === "COMPLETED") return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (status === "BLOCKED") return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
  return <Circle className="h-4 w-4 text-zinc-600 shrink-0" />;
}

export function OnboardingClient({ workflows, stats }: { workflows: any[]; stats: any }) {
  const [isPending, startTransition] = useTransition();
  const [activeStep, setActiveStep] = useState<string | null>(null);

  const handleComplete = (stepId: string) => {
    setActiveStep(stepId);
    startTransition(async () => {
      try {
        await advanceOnboardingStep(stepId);
        toast.success("Step completed", {
          description: "Institutional workflow state advanced. Compliance logs updated."
        });
      } catch (err) {
        toast.error("Operation failed", {
          description: err instanceof Error ? err.message : "Workflow state transition error."
        });
      }
      setActiveStep(null);
    });
  };

  const handleUnblock = (stepId: string) => {
    setActiveStep(stepId);
    startTransition(async () => {
      try {
        await unblockOnboardingStep(stepId);
        toast.info("Step unblocked", {
          description: "Workflow bottleneck resolved. Proceeding to next institutional phase."
        });
      } catch (err) {
        toast.error("Unblock failed.");
      }
      setActiveStep(null);
    });
  };

  const handleStartNew = () => {
    // For demo purposes, we'll try to start onboarding for a random client not in the list or just show a warning
    toast.info("Institutional Setup Required", {
      description: "Please select a client from the CRM to initialize a new institutional onboarding workflow."
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white/90">Onboarding</h1>
          <p className="text-zinc-400 mt-1">Track prospect conversion and account setup workflows.</p>
        </div>
        <Button 
          className="bg-primary hover:bg-primary/90 shadow-[0_0_15px_rgba(var(--primary),0.3)] text-primary-foreground"
          onClick={handleStartNew}
        >
          Start New Onboarding
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Workflows", value: stats.total, color: "text-white" },
          { label: "Avg Health Score", value: `${stats.avgHealth}%`, color: "text-emerald-400" },
          { label: "Blocked", value: stats.blocked, color: "text-red-400" },
          { label: "Complete", value: stats.complete, color: "text-zinc-500" },
        ].map((s) => (
          <Card key={s.label} className="bg-white/[0.02] border-white/5">
            <CardContent className="pt-4 pb-3">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workflows */}
      <div className="flex flex-col gap-5">
        {workflows.map((wf) => {
          const stepProgress = wf.steps.length
            ? Math.round((wf.steps.filter((s: any) => s.status === "COMPLETED").length / wf.steps.length) * 100)
            : 0;
          const hasBlocked = wf.steps.some((s: any) => s.status === "BLOCKED");

          return (
            <motion.div key={wf.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={`overflow-hidden bg-white/[0.02] border-white/5 ${hasBlocked ? "border-red-500/20" : ""}`}>
                <CardHeader className="bg-white/[0.02] pb-4 border-b border-white/5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg text-white/90 flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-zinc-500 shrink-0" />
                        {wf.client.name}
                        <Badge className={`text-[10px] font-medium ${stageColors[wf.stage] ?? stageColors.LEAD}`}>
                          {wf.stage.replace(/_/g, " ")}
                        </Badge>
                        {hasBlocked && (
                          <Badge className="text-[10px] text-red-400 bg-red-500/10 border-red-500/20">BLOCKED</Badge>
                        )}
                      </CardTitle>
                      {wf.notes && (
                        <CardDescription className="text-xs text-zinc-500 mt-1">{wf.notes}</CardDescription>
                      )}
                    </div>
                    <div className="text-right w-44 shrink-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-zinc-500">Progress</span>
                        <span className="text-xs font-semibold text-primary">{stepProgress}%</span>
                      </div>
                      <Progress value={stepProgress} className="h-1.5" />
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-zinc-600">Health</span>
                        <span className={`text-[10px] font-medium ${wf.healthScore >= 70 ? "text-emerald-500" : wf.healthScore >= 40 ? "text-amber-500" : "text-red-500"}`}>
                          {wf.healthScore}/100
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex flex-col gap-2">
                    {wf.steps.map((step: any) => (
                      <div
                        key={step.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                          step.status === "COMPLETED"
                            ? "border-emerald-500/10 bg-emerald-500/5"
                            : step.status === "BLOCKED"
                            ? "border-red-500/20 bg-red-500/5"
                            : "border-white/5 bg-white/[0.01]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <StepIcon status={step.status} />
                          <span className={`text-sm ${step.status === "COMPLETED" ? "text-zinc-500 line-through" : step.status === "BLOCKED" ? "text-red-400" : "text-zinc-300"}`}>
                            {step.name}
                          </span>
                          {step.notes && (
                            <span className="text-xs text-zinc-600 italic">— {step.notes}</span>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {step.status === "BLOCKED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-amber-500/20 text-amber-400 hover:bg-amber-500/10"
                              disabled={isPending && activeStep === step.id}
                              onClick={() => handleUnblock(step.id)}
                            >
                              {isPending && activeStep === step.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Unblock"}
                            </Button>
                          )}
                          {step.status === "PENDING" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-white/10 text-zinc-400 hover:bg-white/5"
                              disabled={isPending && activeStep === step.id}
                              onClick={() => handleComplete(step.id)}
                            >
                              {isPending && activeStep === step.id ? <Loader2 className="h-3 w-3 animate-spin" /> : (
                                <><CheckCircle2 className="mr-1 h-3 w-3" />Mark Complete</>
                              )}
                            </Button>
                          )}
                          {step.status === "COMPLETED" && step.completedAt && (
                            <span className="text-[10px] text-zinc-600">
                              {new Date(step.completedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
