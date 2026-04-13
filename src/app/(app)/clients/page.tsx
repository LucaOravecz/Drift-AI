/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientService } from "@/lib/services/client.service";
import { Search, Plus, Filter, MoreHorizontal, Users } from "lucide-react";

export const revalidate = 0;

export default async function ClientsPage() {
  const clients = await ClientService.getClients();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white/90">Clients</h1>
          <p className="text-zinc-400 mt-1">
            Manage relationships, households, and entities.
          </p>
        </div>
        <div className="flex gap-3">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)] backdrop-blur-md transition-all">
            <Plus className="mr-2 h-4 w-4" /> New Client
          </Button>
        </div>
      </div>

      <Card className="bg-white/[0.02] border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
        <CardHeader className="pb-3 border-b border-white/5 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 max-w-sm w-full">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input
                  type="search"
                  placeholder="Search clients..."
                  className="w-full pl-9 bg-black/40 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-primary/50"
                />
              </div>
              <Button variant="outline" size="icon" className="border-white/10 bg-white/5 hover:bg-white/10">
                <Filter className="h-4 w-4 text-zinc-400" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500 font-medium">
              Showing {clients.length} clients
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 relative z-10">
          {clients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No clients yet"
              description="Start by adding your first client to begin managing relationships and households."
              action={{
                label: "Add your first client",
                onClick: () => window.location.href = "/clients/new",
              }}
              className="border-t border-white/5"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-white/[0.02]">
                  <TableHead className="w-[250px] text-zinc-500 uppercase tracking-wider text-[10px] font-bold">Name</TableHead>
                  <TableHead className="text-zinc-500 uppercase tracking-wider text-[10px] font-bold">Type</TableHead>
                  <TableHead className="text-zinc-500 uppercase tracking-wider text-[10px] font-bold">AUM</TableHead>
                  <TableHead className="text-zinc-500 uppercase tracking-wider text-[10px] font-bold">Risk Profile</TableHead>
                  <TableHead className="text-zinc-500 uppercase tracking-wider text-[10px] font-bold">Last Contact</TableHead>
                  <TableHead className="text-zinc-500 uppercase tracking-wider text-[10px] font-bold">Tags</TableHead>
                  <TableHead className="text-right text-zinc-500 uppercase tracking-wider text-[10px] font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client: any) => (
                  <TableRow key={client.id} className="group cursor-pointer border-white/5 hover:bg-white/[0.04] transition-colors">
                    <TableCell className="font-medium text-white/90">
                      <Link href={`/clients/${client.id}`} className="flex flex-col hover:text-primary transition-colors">
                        <span>{client.name}</span>
                        <span className="text-[10px] text-zinc-500 mt-0.5 font-mono">{client.id.split('').slice(0, 8).join('')}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal text-[10px] bg-white/5 border-white/10 text-zinc-300">
                        {client.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-primary/90">{client.aum}</TableCell>
                    <TableCell className="text-zinc-300">{client.riskProfile}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${client.churnScore > 60 ? 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'}`} />
                        <span className="text-xs text-zinc-400">{client.lastContact}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {client.tags.map((tag: string, i: number) => (
                          <span key={i} className="text-[9px] bg-zinc-800/50 text-zinc-400 px-1.5 py-0.5 rounded border border-white/5">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 hover:text-white text-zinc-500">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-white/[0.01] border border-white/5 border-dashed relative overflow-hidden">
          <div className="absolute left-0 top-0 w-1 h-full bg-primary/30" />
          <CardHeader>
            <CardTitle className="text-sm font-medium text-white/80">Client Intelligence Processing</CardTitle>
            <CardDescription className="text-xs text-zinc-500 mt-1">
              {clients.length > 0
                ? `${clients.length} client records are available for deterministic memory snapshots. Missing fields are surfaced explicitly per client.`
                : "Insufficient data: no client records are stored yet."}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="bg-white/[0.01] border border-white/5 border-dashed relative overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-white/80">Bulk Actions</CardTitle>
            <CardDescription className="text-xs text-zinc-500 mt-1">Bulk client actions are not implemented yet. Use individual client records to refresh memory or review grounded outputs.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
