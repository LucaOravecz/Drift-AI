import Link from "next/link";
import { Settings } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CommandMenu } from "./command-menu";
import { IntelligencePulse } from "../intelligence-pulse";
import { NotificationsMenu } from "./notifications-menu";
import { AccountMenu } from "./account-menu";
import type { BrandingSnapshot } from "@/lib/brand-config";

interface TopHeaderProps {
  branding: BrandingSnapshot;
  currentUser: {
    name: string;
    email: string;
    role: string;
    avatarUrl: string | null;
  };
  summary: {
    clientCount: number;
    draftOpportunityCount: number;
    overdueTaskCount: number;
    unreadNotificationCount: number;
    activeSessionCount: number;
  };
  notifications: {
    id: string;
    title: string;
    body: string;
    status: string;
    link: string | null;
    createdAt: Date;
  }[];
  unreadCount: number;
}

export function TopHeader({ branding, currentUser, summary, notifications, unreadCount }: TopHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.04] bg-[#09090b]/80 backdrop-blur-2xl px-5 supports-[backdrop-filter]:bg-[#09090b]/60">
      <SidebarTrigger className="text-zinc-500 hover:text-zinc-200 transition-colors" />

      <div className="flex h-5 items-center gap-2 px-2 md:px-0">
        <span className="text-[11px] font-medium text-zinc-600">{branding.shortName}</span>
        <span className="text-zinc-800">/</span>
        <span className="text-[11px] font-semibold text-zinc-300">Intelligence</span>
      </div>

      <div className="flex flex-1 items-center gap-4 justify-center">
        <div className="max-w-md w-full flex items-center gap-4">
          <CommandMenu />
          <div className="hidden lg:block">
            <IntelligencePulse summary={summary} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <NotificationsMenu notifications={notifications} unreadCount={unreadCount} />
        <Link href="/settings" className="text-zinc-600 hover:text-zinc-300 transition-colors">
          <Settings className="h-4 w-4" strokeWidth={1.5} />
        </Link>
        <AccountMenu currentUser={currentUser} summary={summary} />
      </div>
    </header>
  );
}
