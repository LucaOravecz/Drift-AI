import { BriefcaseBusiness, Bell, Target, AlertTriangle } from "lucide-react";

interface IntelligencePulseProps {
  summary: {
    clientCount: number;
    draftOpportunityCount: number;
    overdueTaskCount: number;
    unreadNotificationCount: number;
  };
}

export function IntelligencePulse({ summary }: IntelligencePulseProps) {
  const items = [
    { icon: BriefcaseBusiness, label: "Clients", value: summary.clientCount, accent: "text-emerald-400" },
    { icon: Target, label: "Opps", value: summary.draftOpportunityCount, accent: "text-emerald-400" },
    { icon: AlertTriangle, label: "Overdue", value: summary.overdueTaskCount, accent: "text-amber-400" },
    { icon: Bell, label: "Unread", value: summary.unreadNotificationCount, accent: "text-zinc-400" },
  ];

  return (
    <div className="flex items-center gap-1.5 rounded-full ring-1 ring-white/[0.06] bg-white/[0.02] px-2 py-1 backdrop-blur-md">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-1.5 rounded-full bg-white/[0.03] px-2 py-0.5">
            <Icon className={`h-3 w-3 ${item.accent}`} strokeWidth={1.5} />
            <span className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">{item.label}</span>
            <span className="text-[11px] font-semibold text-zinc-200">{item.value}</span>
          </div>
        );
      })}
    </div>
  );
}
