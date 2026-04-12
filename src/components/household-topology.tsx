"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, User, ShieldCheck, Building2, TrendingUp, Link2 } from "lucide-react";
import { motion } from "framer-motion";

interface Member {
  id: string;
  name: string;
  type: string;
  aum: number | null;
  lastContactAt: Date | null;
}

export function HouseholdTopology({ 
  householdId, 
  members 
}: { 
  householdId: string; 
  members: Member[] 
}) {
  if (!householdId) return null;

  const totalAUM = members.reduce((sum, m) => sum + (m.aum || 0), 0);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'HOUSEHOLD': return <Users className="h-4 w-4" />;
      case 'INDIVIDUAL': return <User className="h-4 w-4" />;
      case 'TRUST': return <ShieldCheck className="h-4 w-4" />;
      case 'ENTITY': return <Building2 className="h-4 w-4" />;
      default: return <Link2 className="h-4 w-4" />;
    }
  };

  return (
    <Card className="bg-white/[0.02] border-white/5 overflow-hidden">
      <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-white/5">
        <div>
          <CardTitle className="text-sm font-medium text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Institutional Topology
          </CardTitle>
          <div className="text-xs text-zinc-500 mt-1 font-mono">{householdId}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-white/90 underline decoration-primary/30 underline-offset-4">
            ${(totalAUM / 1000000).toFixed(1)}M Total Assets
          </div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-tighter mt-1">
            Aggregated AUM (Household + Entities)
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="relative">
          {/* Connecting Line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 via-white/5 to-transparent shadow-[0_0_8px_rgba(var(--primary),0.2)]" />

          <div className="space-y-6">
            {members.map((member, index) => (
              <motion.div 
                key={member.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative pl-12"
              >
                {/* Node Dot */}
                <div className={`absolute left-[21px] top-1.5 h-1.5 w-1.5 rounded-full z-10 
                  ${member.type === 'HOUSEHOLD' ? 'bg-primary ring-4 ring-primary/20' : 'bg-zinc-600 ring-4 ring-white/5'}`} 
                />

                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400">
                      {getTypeIcon(member.type)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white/80 group-hover:text-primary transition-colors cursor-pointer capitalize">
                        {member.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-0.5">
                        <span className="uppercase">{member.type}</span>
                        {member.aum && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-zinc-700" />
                            <span className="text-zinc-400">${(member.aum / 1000).toFixed(0)}k AUM</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {member.type === 'HOUSEHOLD' && (
                    <Badge variant="outline" className="text-[10px] bg-primary/10 border-none text-primary uppercase font-bold tracking-widest">
                      Primary Node
                    </Badge>
                  )}
                  
                  {member.type !== 'HOUSEHOLD' && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] text-zinc-500 hover:text-white hover:bg-white/5">
                        View Entity <TrendingUp className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
