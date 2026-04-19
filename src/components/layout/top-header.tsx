import { SidebarTrigger } from "@/components/ui/sidebar";
import { CommandMenu } from "./command-menu";
import { IntelligencePulse } from "../intelligence-pulse";
import { NotificationsMenu } from "./notifications-menu";
import { AccountMenu } from "./account-menu";
import { ThemeToggle } from "./theme-toggle";
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
    upcomingMeetingCount: number;
    pendingVaultCount: number;
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
    <header
      className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b px-5 backdrop-blur-xl"
      style={{
        background: "color-mix(in srgb, var(--background) 78%, transparent)",
        borderBottomColor: "color-mix(in srgb, var(--border) 100%, transparent)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <SidebarTrigger
        className="rounded-full border border-[color:var(--border)] bg-[color:var(--muted)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--secondary)] hover:text-[color:var(--foreground)]"
      />

      <div
        className="flex h-7 items-center gap-2 px-3"
        style={{
          background: "color-mix(in srgb, var(--muted) 100%, transparent)",
          border: "0.5px solid color-mix(in srgb, var(--border) 125%, transparent)",
          borderRadius: "999px",
          color: "color-mix(in srgb, var(--foreground) 72%, transparent)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <span className="text-[11px] font-medium">{branding.shortName}</span>
        <span className="opacity-25">/</span>
        <span className="text-[11px] font-semibold">Meeting Prep</span>
      </div>

      <div className="flex flex-1 items-center justify-center gap-4">
        <div className="max-w-md w-full flex items-center gap-4">
          <CommandMenu />
          <div className="hidden lg:block">
            <IntelligencePulse summary={summary} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <NotificationsMenu notifications={notifications} unreadCount={unreadCount} />
        <ThemeToggle />
        <AccountMenu currentUser={currentUser} summary={summary} />
      </div>
    </header>
  );
}
