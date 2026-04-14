"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Plus, Search, Users } from "lucide-react";

type ClientListItem = {
  id: string;
  name: string;
  type: string;
  email: string | null;
  aum: string;
  riskProfile: string;
  churnScore: number;
  lastContact: string;
  sentiment: number;
  tags: string[];
};

const FILTERS = ["ALL", "HOUSEHOLD", "INDIVIDUAL", "ENTITY", "TRUST"];

export function ClientsPageClient({ clients }: { clients: ClientListItem[] }) {
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState("ALL");
  const atRiskCount = clients.filter((client) => client.churnScore > 60).length;
  const taggedCount = clients.filter((client) => client.tags.length > 0).length;

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return clients.filter((client) => {
      const typeMatches = activeType === "ALL" || client.type === activeType;
      if (!typeMatches) return false;

      if (!normalizedQuery) return true;

      const haystack = [
        client.name,
        client.email ?? "",
        client.type,
        client.riskProfile,
        ...client.tags,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [activeType, clients, query]);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr_0.7fr]">
        <Card className="border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(63,182,139,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(10,14,13,0.82))] shadow-2xl">
          <CardHeader>
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Household intelligence</div>
            <CardTitle className="mt-2 text-2xl font-semibold tracking-tight text-white">Relationship context before the next call.</CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-6 text-zinc-300">
              Drift should make each household feel like a living operating record, not a CRM row. Search, segment, and move straight into prep, onboarding, or follow-up.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-white/8 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-300">Households on watch</CardTitle>
            <CardDescription className="text-3xl font-semibold tracking-tight text-white">{atRiskCount}</CardDescription>
            <p className="text-xs leading-5 text-zinc-500">Relationships with elevated churn pressure that should be reviewed before the next scheduled touchpoint.</p>
          </CardHeader>
        </Card>
        <Card className="border-white/8 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-300">Tagged for action</CardTitle>
            <CardDescription className="text-3xl font-semibold tracking-tight text-white">{taggedCount}</CardDescription>
            <p className="text-xs leading-5 text-zinc-500">Households already carrying tags you can use to route prep, planning, or communication workflows.</p>
          </CardHeader>
        </Card>
      </div>

      <Card className="bg-white/[0.02] border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
        <CardHeader className="pb-3 border-b border-white/5 relative z-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3">
              <div className="relative max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search clients, tags, risk profile..."
                  aria-label="Search clients"
                  className="w-full pl-9 bg-black/40 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-primary/50"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((filter) => (
                  <Button
                    key={filter}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveType(filter)}
                    className={
                      activeType === filter
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300"
                    }
                  >
                    {filter === "ALL" ? "All Types" : filter}
                  </Button>
                ))}
              </div>
            </div>
            <div className="text-sm text-zinc-500 font-medium">
              Showing {filteredClients.length} of {clients.length} households
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 relative z-10">
          {filteredClients.length === 0 ? (
            <EmptyState
              icon={Users}
              title={clients.length === 0 ? "No clients yet" : "No clients match that search"}
              description={
                clients.length === 0
                  ? "Start by importing a roster or launching your first onboarding workflow."
                  : "Try a different name, tag, or client type filter."
              }
              action={{
                label: clients.length === 0 ? "Start onboarding" : "Clear filters",
                onClick: () => {
                  setQuery("");
                  setActiveType("ALL");
                },
              }}
              className="border-t border-white/5"
            />
          ) : (
            <div className="relative w-full overflow-x-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-white/5 hover:bg-white/[0.02]">
                    <th className="h-10 w-[250px] px-2 text-left align-middle font-bold uppercase tracking-wider whitespace-nowrap text-[10px] text-zinc-500">Name</th>
                    <th className="h-10 px-2 text-left align-middle font-bold uppercase tracking-wider whitespace-nowrap text-[10px] text-zinc-500">Type</th>
                    <th className="h-10 px-2 text-left align-middle font-bold uppercase tracking-wider whitespace-nowrap text-[10px] text-zinc-500">AUM</th>
                    <th className="h-10 px-2 text-left align-middle font-bold uppercase tracking-wider whitespace-nowrap text-[10px] text-zinc-500">Risk Profile</th>
                    <th className="h-10 px-2 text-left align-middle font-bold uppercase tracking-wider whitespace-nowrap text-[10px] text-zinc-500">Relationship Pulse</th>
                    <th className="h-10 px-2 text-left align-middle font-bold uppercase tracking-wider whitespace-nowrap text-[10px] text-zinc-500">Tags</th>
                    <th className="h-10 px-2 text-right align-middle font-bold uppercase tracking-wider whitespace-nowrap text-[10px] text-zinc-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="group cursor-pointer border-b border-white/5 hover:bg-white/[0.04] transition-colors">
                    <td className="p-2 align-middle whitespace-nowrap font-medium text-white/90">
                      <Link href={`/clients/${client.id}`} className="flex flex-col hover:text-primary transition-colors">
                        <span>{client.name}</span>
                        <span className="text-[10px] text-zinc-500 mt-0.5 font-mono">{client.id.slice(0, 8)}</span>
                      </Link>
                    </td>
                    <td className="p-2 align-middle whitespace-nowrap">
                      <Badge variant="outline" className="font-normal text-[10px] bg-white/5 border-white/10 text-zinc-300">
                        {client.type}
                      </Badge>
                    </td>
                    <td className="p-2 align-middle whitespace-nowrap font-semibold text-primary/90">{client.aum}</td>
                    <td className="p-2 align-middle whitespace-nowrap text-zinc-300">{client.riskProfile}</td>
                    <td className="p-2 align-middle whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${client.churnScore > 60 ? "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"}`} />
                        <span className="text-xs text-zinc-400">{client.lastContact}</span>
                        <span className="text-[10px] text-zinc-600">• sentiment {client.sentiment}</span>
                      </div>
                    </td>
                    <td className="p-2 align-middle whitespace-nowrap">
                      <div className="flex gap-1 flex-wrap">
                        {client.tags.map((tag) => (
                          <span key={tag} className="text-[9px] bg-zinc-800/50 text-zinc-400 px-1.5 py-0.5 rounded border border-white/5">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-2 align-middle whitespace-nowrap text-right">
                      <Link
                        href={`/clients/${client.id}`}
                        aria-label={`Open ${client.name}`}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "icon" }),
                          "opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 hover:text-white text-zinc-500"
                        )}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-white/[0.01] border border-white/5 border-dashed relative overflow-hidden">
          <div className="absolute left-0 top-0 w-1 h-full bg-primary/30" />
          <CardHeader>
            <CardTitle className="text-sm font-medium text-white/80">Household memory coverage</CardTitle>
            <CardDescription className="text-xs text-zinc-500 mt-1">
              {clients.length > 0
                ? `${clients.length} households are available for grounded memory snapshots. Missing context should be surfaced before prep and follow-up are generated.`
                : "Insufficient data: no households are stored yet."}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="bg-white/[0.01] border border-white/5 border-dashed relative overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-white/80">Next best move</CardTitle>
            <CardDescription className="text-xs text-zinc-500 mt-1">
              Import or enrich the highest-priority households first, then route them into onboarding so meeting prep and follow-up feel complete from day one.
            </CardDescription>
            <div className="pt-2">
              <Link href="/onboarding" className={cn(buttonVariants({ size: "sm" }), "w-fit")}>
                <Plus className="mr-2 h-4 w-4" />
                Start Onboarding
              </Link>
            </div>
          </CardHeader>
        </Card>
      </div>
    </>
  );
}
