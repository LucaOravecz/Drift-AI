"use client";

import { Home, Users, Target, Landmark, LineChart, Briefcase, ShieldCheck, Mail, FileText, UserPlus, Zap, BookOpen, Newspaper, Brain, Bot, MessageSquare, UserCog, TrendingDown, DollarSign, ArrowRightLeft, FileCheck } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { BrandLogo } from "./brand-logo";
import type { BrandingSnapshot } from "@/lib/brand-config";

const baseNavGroups = [
  {
    label: "Core",
    items: [
      { title: "Dashboard", url: "/", icon: Home },
      { title: "Clients", url: "/clients", icon: Users },
      { title: "Opportunities", url: "/opportunities", icon: Target },
    ],
  },
  {
    label: "Engine",
    items: [
      { title: "Advisor Copilot", url: "/copilot", icon: MessageSquare },
      { title: "Intelligence Engine", url: "/intelligence", icon: Brain },
      { title: "Agent Command Center", url: "/agents", icon: Bot },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { title: "Tax Insights", url: "/tax", icon: Landmark },
      { title: "Tax-Loss Harvesting", url: "/tlh", icon: TrendingDown },
      { title: "Investment Research", url: "/research", icon: LineChart },
      { title: "Meeting Briefs", url: "/meetings", icon: Briefcase },
      { title: "News Oracle", url: "/news", icon: Newspaper },
      { title: "Compliance", url: "/compliance", icon: ShieldCheck },
      { title: "Audit Ledger", url: "/audit", icon: BookOpen },
    ],
  },
  {
    label: "Workflows",
    items: [
      { title: "Proactive Triggers", url: "/triggers", icon: Zap },
      { title: "IPS & Proposals", url: "/proposals", icon: FileCheck },
      { title: "Sales & Leads", url: "/sales", icon: Zap },
      { title: "Onboarding", url: "/onboarding", icon: UserPlus },
      { title: "Documents", url: "/documents", icon: FileText },
      { title: "Communications", url: "/communications", icon: Mail },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Billing & Fees", url: "/billing", icon: DollarSign },
      { title: "Integrations", url: "/integrations", icon: ArrowRightLeft },
    ],
  },
];

export function AppSidebar({ branding, canManageUsers = false }: { branding: BrandingSnapshot; canManageUsers?: boolean }) {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  // Close mobile sidebar when route changes
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  const navGroups = canManageUsers
    ? [
        ...baseNavGroups,
        {
          label: "Admin",
          items: [{ title: "Admin Users", url: "/admin/users", icon: UserCog }],
        },
      ]
    : baseNavGroups;

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="p-5 pb-3">
        <BrandLogo branding={branding} />
      </SidebarHeader>
      <SidebarContent className="px-3 pb-4">
        {navGroups.map((group, gi) => (
          <SidebarGroup key={group.label} className={gi > 0 ? "mt-1" : ""}>
            <SidebarGroupLabel className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600 px-2 mb-1">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.url || (pathname.startsWith(item.url) && item.url !== "/");
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        className={`h-8 rounded-lg text-[13px] font-medium transition-all duration-200 ${isActive ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/15 hover:bg-emerald-500/15" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"}`}
                      >
                        <Link href={item.url} className="flex items-center gap-2.5 w-full">
                          <item.icon className={`h-[15px] w-[15px] ${isActive ? "text-emerald-400" : "text-zinc-500"}`} strokeWidth={1.5} />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
