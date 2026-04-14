"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { ClientPortalExperience } from "@/lib/client-portal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FilePenLine,
  FolderLock,
  HeartHandshake,
  Landmark,
  LineChart,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
    notation: value >= 1_000_000 ? "compact" : "standard",
  }).format(value);
}

function percent(value: number) {
  return `${value.toFixed(0)}%`;
}

function longDate(value: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sectionTone(index: number) {
  const tones = [
    "from-[#f3f0e6]/10 via-[#f3f0e6]/4 to-transparent",
    "from-[#a6b3ff]/14 via-[#a6b3ff]/3 to-transparent",
    "from-[#7bc7a6]/14 via-[#7bc7a6]/3 to-transparent",
    "from-[#f7c27a]/14 via-[#f7c27a]/3 to-transparent",
  ];
  return tones[index % tones.length];
}

export function ClientPortalExperienceView({ portal }: { portal: ClientPortalExperience }) {
  const [activeTab, setActiveTab] = useState("dashboard");

  const householdStats = useMemo(
    () => [
      { label: "Total household value", value: currency(portal.overview.totalNetWorth) },
      { label: "Funded status", value: percent(portal.overview.fundedStatusPercent) },
      { label: "Target monthly income", value: currency(portal.overview.monthlyIncomeAtTargetRetirement) },
      { label: "Documents in vault", value: String(portal.documents.length) },
    ],
    [portal],
  );

  return (
    <div className="min-h-screen bg-[#0c0f12] text-[#f5f2ea]">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(243,240,230,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(166,179,255,0.18),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(12,15,18,0.96))]" />
        <div className="absolute inset-x-0 top-0 h-px bg-white/15" />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 pb-10 pt-8 md:px-8 lg:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-5">
              <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-[#b7b0a2]">
                <span>{portal.client.portalLabel} Family Portal</span>
                <span className="h-1 w-1 rounded-full bg-[#b7b0a2]" />
                <span>{portal.client.organizationName}</span>
                <span className="h-1 w-1 rounded-full bg-[#b7b0a2]" />
                <span>Updated {shortDateTime(portal.client.lastUpdatedAt)}</span>
              </div>
              <div className="space-y-3">
                <h1 className="max-w-4xl font-serif text-4xl leading-none tracking-[-0.05em] text-[#f8f4ed] md:text-6xl">
                  The financial life dashboard clients actually return to.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[#bdb6a9] md:text-lg">
                  {portal.client.tagline}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Badge className="border-white/12 bg-white/[0.06] px-3 py-1 text-[#f5f2ea]">
                  {portal.client.riskProfile}
                </Badge>
                <Badge className="border-white/12 bg-white/[0.06] px-3 py-1 text-[#f5f2ea]">
                  {portal.client.lifeStage.replaceAll("_", " ")}
                </Badge>
                <Badge className="border-white/12 bg-white/[0.06] px-3 py-1 text-[#f5f2ea]">
                  Advisor: {portal.client.advisorName}
                </Badge>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#9f988b]">Readiness</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{percent(portal.overview.fundedStatusPercent)}</p>
                </div>
                <ShieldCheck className="h-9 w-9 text-[#f3f0e6]" strokeWidth={1.5} />
              </div>
              <div className="grid gap-4 pt-4 sm:grid-cols-2">
                {householdStats.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/7 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#90897d]">{item.label}</p>
                    <p className="mt-2 text-lg font-medium tracking-[-0.03em] text-[#f8f4ed]">{item.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {portal.goals.map((goal, index) => (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, delay: index * 0.06 }}
              >
                <Card className={`min-h-full border-white/8 bg-gradient-to-br ${sectionTone(index)} from-0% to-100% text-[#f5f2ea]`}>
                  <CardHeader>
                    <CardDescription className="text-[#b8b09f]">{goal.targetLabel}</CardDescription>
                    <CardTitle className="text-xl tracking-[-0.03em] text-[#f8f4ed]">{goal.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-[#d8d1c4]">
                        <span>Progress</span>
                        <span>{goal.fundedPercent}% funded</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/8">
                        <div className="h-2 rounded-full bg-[#f3eee3]" style={{ width: `${goal.fundedPercent}%` }} />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-[#90897d]">Current</p>
                        <p className="mt-1 text-sm text-[#f3eee4]">{goal.currentValueLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-[#90897d]">Gap</p>
                        <p className="mt-1 text-sm text-[#f3eee4]">{goal.gapLabel}</p>
                      </div>
                    </div>
                    <p className="text-sm leading-6 text-[#bfb8ac]">{goal.detail}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 pb-14 md:px-8 lg:px-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-8">
          <TabsList className="flex w-full flex-wrap gap-2 rounded-[24px] border border-white/8 bg-white/[0.04] p-2">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="vault">Vault</TabsTrigger>
            <TabsTrigger value="family">Family</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.25fr_0.95fr]">
              <Card className="border-white/8 bg-white/[0.04] text-[#f5f2ea]">
                <CardHeader className="gap-3 border-b border-white/8">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardDescription className="text-[#a39d91]">Retirement scenario engine</CardDescription>
                      <CardTitle className="text-2xl tracking-[-0.04em] text-[#f8f4ed]">What changes if you retire earlier?</CardTitle>
                    </div>
                    <LineChart className="h-8 w-8 text-[#e7decf]" strokeWidth={1.5} />
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
                  {portal.scenarios.map((scenario) => (
                    <div key={scenario.id} className="rounded-[24px] border border-white/8 bg-black/20 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-[#8f887b]">{scenario.label}</p>
                          <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#f8f4ed]">
                            {currency(scenario.monthlyIncome)}
                            <span className="ml-1 text-sm font-normal tracking-normal text-[#b8b09f]">/mo</span>
                          </p>
                        </div>
                        <Badge className="border-white/10 bg-white/[0.06] text-[#f5f2ea]">
                          {Math.round(scenario.successRate * 100)}% success
                        </Badge>
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-[#d9d2c5]">
                        <div className="flex items-center justify-between">
                          <span>Funded status</span>
                          <span>{scenario.fundedPercent}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Median ending value</span>
                          <span>{currency(scenario.medianEndingValue)}</span>
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-[#b6afa2]">{scenario.narrative}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-white/8 bg-white/[0.04] text-[#f5f2ea]">
                <CardHeader className="border-b border-white/8">
                  <CardDescription className="text-[#a39d91]">Open now</CardDescription>
                  <CardTitle className="text-2xl tracking-[-0.04em] text-[#f8f4ed]">Service queue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-6">
                  {portal.openItems.map((item) => (
                    <div key={item.id} className="rounded-[22px] border border-white/7 bg-black/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[#f6f1e7]">{item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-[#b8b09f]">{item.detail}</p>
                        </div>
                        <Badge className="border-white/10 bg-white/[0.06] text-[#f5f2ea]">{item.status}</Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-[#8f887b]">
                        <span>{item.type}</span>
                        <span>{item.dueLabel}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="border-white/8 bg-white/[0.04] text-[#f5f2ea]">
                <CardHeader className="border-b border-white/8">
                  <CardDescription className="text-[#a39d91]">Portfolio view</CardDescription>
                  <CardTitle className="text-2xl tracking-[-0.04em] text-[#f8f4ed]">Allocation and account structure</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 pt-6">
                  <div className="grid gap-3">
                    {portal.allocation.map((slice) => (
                      <div key={slice.label} className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-[#d8d1c4]">
                          <span>{slice.label}</span>
                          <span>
                            {percent(slice.percentage)} · {currency(slice.value)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/8">
                          <div className="h-2 rounded-full bg-[#f1eadc]" style={{ width: `${Math.min(slice.percentage, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {portal.accounts.map((account) => (
                      <div key={account.id} className="rounded-[24px] border border-white/7 bg-black/20 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-[#8f887b]">{account.custodian}</p>
                            <p className="mt-2 text-lg font-medium tracking-[-0.03em] text-[#f7f1e5]">{account.name}</p>
                          </div>
                          <p className="text-sm text-[#d8d1c4]">{currency(account.totalValue)}</p>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {account.targetMix.map((item) => (
                            <span key={item.label} className="rounded-full border border-white/8 px-3 py-1 text-xs uppercase tracking-[0.14em] text-[#b8b09f]">
                              {item.label} {item.percentage}%
                            </span>
                          ))}
                        </div>
                        <div className="mt-4 space-y-3">
                          {account.topHoldings.map((holding) => (
                            <div key={holding.ticker} className="flex items-center justify-between text-sm text-[#d8d1c4]">
                              <div>
                                <span className="font-medium text-[#f7f1e5]">{holding.ticker}</span>
                                <span className="ml-2 text-[#a39d91]">{holding.name}</span>
                              </div>
                              <span>{currency(holding.marketValue)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/8 bg-white/[0.04] text-[#f5f2ea]">
                <CardHeader className="border-b border-white/8">
                  <CardDescription className="text-[#a39d91]">Advisor intelligence</CardDescription>
                  <CardTitle className="text-2xl tracking-[-0.04em] text-[#f8f4ed]">{portal.insights.headline}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <p className="max-w-[65ch] text-sm leading-7 text-[#c3bcaf]">{portal.insights.summary}</p>
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#8f887b]">Strengths</p>
                    {portal.insights.strengths.map((item) => (
                      <div key={item} className="flex items-start gap-3 rounded-[22px] border border-white/7 bg-black/20 p-4">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#f0e5d2]" />
                        <p className="text-sm leading-6 text-[#e0d8cb]">{item}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#8f887b]">Worth attention</p>
                    {portal.insights.watchItems.length > 0 ? (
                      portal.insights.watchItems.map((item) => (
                        <div key={item} className="flex items-start gap-3 rounded-[22px] border border-white/7 bg-black/20 p-4">
                          <Sparkles className="mt-0.5 h-4 w-4 text-[#f3c987]" />
                          <p className="text-sm leading-6 text-[#e0d8cb]">{item}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[22px] border border-white/7 bg-black/20 p-4 text-sm text-[#e0d8cb]">
                        No watch items surfaced right now.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="vault" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-white/8 bg-white/[0.04] text-[#f5f2ea]">
                <CardHeader className="border-b border-white/8">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardDescription className="text-[#a39d91]">Secure document vault</CardDescription>
                      <CardTitle className="text-2xl tracking-[-0.04em] text-[#f8f4ed]">Every statement, tax form, and signature in one place</CardTitle>
                    </div>
                    <FolderLock className="h-8 w-8 text-[#f0e8da]" strokeWidth={1.5} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {portal.documents.map((document) => (
                    <div key={document.id} className="rounded-[24px] border border-white/8 bg-black/20 p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border-white/10 bg-white/[0.06] text-[#f5f2ea]">{document.category}</Badge>
                            <Badge className="border-white/10 bg-white/[0.06] text-[#f5f2ea]">{document.status}</Badge>
                            {document.requiresSignature ? (
                              <Badge className="border-white/10 bg-[#f5e8c9]/12 text-[#f4e7d1]">E-sign ready</Badge>
                            ) : null}
                          </div>
                          <p className="text-lg font-medium tracking-[-0.03em] text-[#f7f1e5]">{document.fileName}</p>
                          <p className="max-w-[70ch] text-sm leading-6 text-[#b8b09f]">{document.summary}</p>
                        </div>
                        <div className="text-sm text-[#b8b09f]">
                          <p>{longDate(document.uploadedAt)}</p>
                          <p className="mt-1">{currency(document.fileSizeBytes)}</p>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-xs uppercase tracking-[0.18em] text-[#8f887b]">Action items</p>
                          {document.actionItems.length > 0 ? (
                            document.actionItems.map((item) => (
                              <div key={item} className="flex items-start gap-3 text-sm text-[#ddd5c7]">
                                <ChevronRight className="mt-0.5 h-4 w-4 text-[#f0e5d2]" />
                                <span>{item}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-[#b8b09f]">No outstanding action items.</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs uppercase tracking-[0.18em] text-[#8f887b]">Risk markers</p>
                          {document.riskItems.length > 0 ? (
                            document.riskItems.map((item) => (
                              <div key={item} className="flex items-start gap-3 text-sm text-[#ddd5c7]">
                                <FilePenLine className="mt-0.5 h-4 w-4 text-[#f3c987]" />
                                <span>{item}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-[#b8b09f]">No active risk notes.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-white/8 bg-white/[0.04] text-[#f5f2ea]">
                <CardHeader className="border-b border-white/8">
                  <CardDescription className="text-[#a39d91]">Portal actions</CardDescription>
                  <CardTitle className="text-2xl tracking-[-0.04em] text-[#f8f4ed]">The DocuSign and file-sharing replacement</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {[
                    {
                      icon: FilePenLine,
                      title: "Sign planning packets online",
                      detail: "Acknowledge recommendations and proposals from the same place you read them.",
                    },
                    {
                      icon: FolderLock,
                      title: "Upload tax returns securely",
                      detail: "Clients can drag in source documents without emailing PDFs back and forth.",
                    },
                    {
                      icon: CalendarClock,
                      title: "Track what is still pending",
                      detail: "Requests, reviews, and meeting prep are visible without having to ask the advisor for a status check.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="rounded-[22px] border border-white/8 bg-black/20 p-5">
                      <div className="flex items-start gap-4">
                        <div className="rounded-2xl border border-white/8 bg-white/[0.06] p-3">
                          <item.icon className="h-5 w-5 text-[#f2ead9]" strokeWidth={1.5} />
                        </div>
                        <div>
                          <p className="text-base font-medium text-[#f7f1e5]">{item.title}</p>
                          <p className="mt-2 text-sm leading-6 text-[#b8b09f]">{item.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(135deg,rgba(243,240,230,0.12),rgba(166,179,255,0.08))] p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#918a7d]">Next milestone</p>
                    <p className="mt-2 text-xl font-medium tracking-[-0.03em] text-[#f8f4ed]">{portal.overview.nextMilestoneLabel}</p>
                    <p className="mt-2 text-sm text-[#c7bfaf]">{longDate(portal.overview.nextMilestoneDate)}</p>
                    <Button className="mt-5 rounded-full bg-[#f4efe5] px-4 text-[#111317] hover:bg-[#fff8eb]">
                      Review next steps
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="family" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
              <Card className="border-white/8 bg-white/[0.04] text-[#f5f2ea]">
                <CardHeader className="border-b border-white/8">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardDescription className="text-[#a39d91]">Family wealth hub</CardDescription>
                      <CardTitle className="text-2xl tracking-[-0.04em] text-[#f8f4ed]">{portal.family.householdName}</CardTitle>
                    </div>
                    <Users className="h-8 w-8 text-[#f0e8da]" strokeWidth={1.5} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="rounded-[24px] border border-white/8 bg-black/20 p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#8f887b]">Collective value</p>
                    <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-[#f8f4ed]">{currency(portal.family.totalHouseholdValue)}</p>
                    <p className="mt-2 text-sm text-[#b8b09f]">
                      One family-level view of accounts, trusts, documents, and ongoing service work.
                    </p>
                  </div>
                  {portal.family.members.map((member) => (
                    <div key={member.id} className="rounded-[24px] border border-white/8 bg-black/20 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-medium tracking-[-0.03em] text-[#f7f1e5]">{member.name}</p>
                          <p className="mt-1 text-sm text-[#b8b09f]">{member.roleLabel}</p>
                        </div>
                        <Badge className="border-white/10 bg-white/[0.06] text-[#f5f2ea]">{member.entityType}</Badge>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-[#8f887b]">Net worth</p>
                          <p className="mt-2 text-sm text-[#ece4d6]">{currency(member.netWorth)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-[#8f887b]">Accounts</p>
                          <p className="mt-2 text-sm text-[#ece4d6]">{member.accountCount}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-[#8f887b]">Documents</p>
                          <p className="mt-2 text-sm text-[#ece4d6]">{member.documentCount}</p>
                        </div>
                      </div>
                      <p className="mt-4 text-sm text-[#b8b09f]">{member.lastTouchLabel}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-white/8 bg-white/[0.04] text-[#f5f2ea]">
                <CardHeader className="border-b border-white/8">
                  <CardDescription className="text-[#a39d91]">Why households stay</CardDescription>
                  <CardTitle className="text-2xl tracking-[-0.04em] text-[#f8f4ed]">Switching advisors becomes a family decision</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {[
                    {
                      icon: HeartHandshake,
                      title: "Shared context across generations",
                      detail: "Parents, trusts, and entity structures live in one graph instead of being scattered across custodians and inboxes.",
                    },
                    {
                      icon: Landmark,
                      title: "Visible wealth transfer mechanics",
                      detail: "Clients can see where assets sit, which entities hold them, and which planning tasks are still open.",
                    },
                    {
                      icon: ShieldCheck,
                      title: "Documents stay attached to decisions",
                      detail: "Beneficiary updates, trust agreements, and planning memos stay connected to the family record.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="rounded-[24px] border border-white/8 bg-black/20 p-5">
                      <div className="flex items-start gap-4">
                        <div className="rounded-2xl border border-white/8 bg-white/[0.06] p-3">
                          <item.icon className="h-5 w-5 text-[#f2ead9]" strokeWidth={1.5} />
                        </div>
                        <div>
                          <p className="text-base font-medium text-[#f7f1e5]">{item.title}</p>
                          <p className="mt-2 text-sm leading-6 text-[#b8b09f]">{item.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <Card className="border-white/8 bg-white/[0.04] text-[#f5f2ea]">
                <CardHeader className="border-b border-white/8">
                  <CardDescription className="text-[#a39d91]">Timeline</CardDescription>
                  <CardTitle className="text-2xl tracking-[-0.04em] text-[#f8f4ed]">Upcoming milestones and recent activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {portal.timeline.map((item) => (
                    <div key={item.id} className="rounded-[24px] border border-white/8 bg-black/20 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm uppercase tracking-[0.16em] text-[#8f887b]">{item.kind.replace("_", " ")}</p>
                          <p className="mt-2 text-lg font-medium tracking-[-0.03em] text-[#f7f1e5]">{item.title}</p>
                          <p className="mt-2 text-sm leading-6 text-[#b8b09f]">{item.detail}</p>
                        </div>
                        <p className="text-sm text-[#d9d2c5]">{longDate(item.date)}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-white/8 bg-white/[0.04] text-[#f5f2ea]">
                <CardHeader className="border-b border-white/8">
                  <CardDescription className="text-[#a39d91]">Secure communications</CardDescription>
                  <CardTitle className="text-2xl tracking-[-0.04em] text-[#f8f4ed]">Client and advisor communication history</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {portal.communications.map((message) => (
                    <div key={message.id} className="rounded-[24px] border border-white/8 bg-black/20 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border-white/10 bg-white/[0.06] text-[#f5f2ea]">{message.direction}</Badge>
                            <Badge className="border-white/10 bg-white/[0.06] text-[#f5f2ea]">{message.status}</Badge>
                          </div>
                          <p className="mt-3 text-base font-medium text-[#f7f1e5]">{message.subject}</p>
                          <p className="mt-2 text-sm leading-6 text-[#b8b09f]">{message.preview || "No preview available."}</p>
                        </div>
                        <p className="text-sm text-[#d9d2c5]">{shortDateTime(message.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
