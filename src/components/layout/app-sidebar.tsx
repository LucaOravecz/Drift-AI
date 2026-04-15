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
    <Sidebar
      variant="floating"
      collapsible="icon"
      className="border-r-0 p-3"
      style={{
        ["--sidebar-width" as string]: "17rem",
      }}
    >
      <SidebarHeader className="px-4 pb-4 pt-5">
        <div
          className="glass-bright flex min-h-[72px] items-center px-4"
          style={{
            background: "linear-gradient(180deg, color-mix(in srgb, var(--sidebar) 100%, rgba(255,255,255,0.04)) 0%, color-mix(in srgb, var(--sidebar) 88%, transparent) 100%)",
          }}
        >
          <BrandLogo branding={branding} />
        </div>
      </SidebarHeader>
      <SidebarContent
        className="px-3 pb-4"
        style={{
          background: "transparent",
        }}
      >
        {navGroups.map((group, gi) => (
          <SidebarGroup key={group.label} className={gi > 0 ? "mt-1" : ""}>
            <SidebarGroupLabel
              className="mb-1 px-2 text-[10px] font-medium uppercase tracking-[0.08em]"
              style={{
                color: "color-mix(in srgb, var(--sidebar-foreground) 38%, transparent)",
              }}
            >
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.url || (pathname.startsWith(item.url) && item.url !== "/");
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        className={`h-10 rounded-[10px] px-1.5 text-[13px] font-medium transition-all duration-200 ${isActive ? "translate-x-[1px]" : "hover:translate-x-[2px]"}`}
                        style={
                          isActive
                            ? {
                                background: "rgba(29,158,117,0.15)",
                                border: "0.5px solid rgba(29,158,117,0.25)",
                                borderRadius: "10px",
                                color: "#5DCAA5",
                                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                              }
                            : {
                                borderRadius: "10px",
                                color: "color-mix(in srgb, var(--sidebar-foreground) 82%, transparent)",
                                background: "transparent",
                                border: "0.5px solid transparent",
                              }
                        }
                        onMouseEnter={(event) => {
                          if (isActive) return;
                          event.currentTarget.style.background = "color-mix(in srgb, var(--sidebar-accent) 100%, transparent)";
                          event.currentTarget.style.borderColor = "color-mix(in srgb, var(--sidebar-border) 110%, transparent)";
                          event.currentTarget.style.color = "color-mix(in srgb, var(--foreground) 76%, transparent)";
                        }}
                        onMouseLeave={(event) => {
                          if (isActive) return;
                          event.currentTarget.style.background = "transparent";
                          event.currentTarget.style.borderColor = "transparent";
                          event.currentTarget.style.color = "color-mix(in srgb, var(--sidebar-foreground) 82%, transparent)";
                        }}
                      >
                        <Link href={item.url} className="flex items-center gap-2.5 w-full">
                          <item.icon
                            className="h-[15px] w-[15px]"
                            style={{
                              color: isActive ? "#5DCAA5" : "color-mix(in srgb, var(--sidebar-foreground) 70%, transparent)",
                            }}
                            strokeWidth={1.5}
                          />
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
