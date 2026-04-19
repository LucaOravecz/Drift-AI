"use client";

import {
  MessageSquare,
  Users,
  Briefcase,
  Folder,
  Shield,
  LogOut,
  Search,
  Plus,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ComponentType } from "react";
import type { BrandingSnapshot } from "@/lib/brand-config";
import { signOutAction } from "@/lib/product-actions";

const primaryNav = [
  { title: "Copilot", url: "/copilot", icon: MessageSquare },
  { title: "Meetings", url: "/meetings", icon: Briefcase },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Vault", url: "/vault", icon: Folder },
  { title: "Compliance", url: "/compliance", icon: Shield },
] as const;

function initials(snapshot: BrandingSnapshot) {
  const s = snapshot.shortName?.trim() || snapshot.wordmark?.trim() || "DR";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

const navItemClass = cn(
  "h-9 rounded-lg px-2 text-[13px] font-medium border border-transparent",
  "text-[color:var(--sidebar-foreground)]",
  "hover:bg-[color:var(--sidebar-accent)] hover:text-[color:var(--sidebar-accent-foreground)] hover:border-[color:var(--sidebar-border)]",
  "data-[active=true]:bg-[color:var(--sidebar-active-bg)] data-[active=true]:border-[color:var(--sidebar-active-border)] data-[active=true]:text-[color:var(--sidebar-active-fg)]"
);

function NavItem({
  item,
  isActive,
}: {
  item: { title: string; url: string; icon: ComponentType<{ className?: string; strokeWidth?: number }> };
  isActive: boolean;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={item.title}
        className={navItemClass}
        render={
          <Link href={item.url} className="flex items-center gap-2.5">
            <item.icon
              className={cn(
                "h-[15px] w-[15px] shrink-0",
                isActive
                  ? "text-[color:var(--sidebar-active-fg)]"
                  : "text-[color:var(--sidebar-foreground)] opacity-60"
              )}
              strokeWidth={1.5}
            />
            <span>{item.title}</span>
          </Link>
        }
      />
    </SidebarMenuItem>
  );
}

export function AppSidebar({
  branding,
}: {
  branding: BrandingSnapshot;
}) {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  const linkIsActive = (url: string) =>
    pathname === url || (url !== "/" && pathname.startsWith(url));

  return (
    // CSS custom property — no Tailwind utility supports arbitrary var injection on the Sidebar root
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="border-r border-[color:var(--sidebar-border)] bg-[color:var(--sidebar)]"
      style={{ ["--sidebar-width" as string]: "15.5rem" }}
    >
      <SidebarHeader className="gap-3 px-3 pb-2 pt-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg px-1 py-0.5 outline-none ring-sidebar-ring focus-visible:ring-2"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[color:var(--foreground)] text-[color:var(--background)] font-semibold text-[11px] tracking-tight">
            {initials(branding)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate font-heading text-base font-normal leading-tight tracking-tight text-[color:var(--foreground)]">
              {branding.wordmark}
            </span>
            <span className="truncate text-[11px] text-[color:var(--muted-foreground)]">
              {branding.shortName}
            </span>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("drift:open-command-menu"))}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-9 w-full justify-start gap-2 rounded-lg font-normal text-muted-foreground shadow-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          )}
        >
          <Search className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.5} />
          <span className="truncate group-data-[collapsible=icon]:sr-only">Search…</span>
          <kbd className="ml-auto hidden group-data-[collapsible=icon]:hidden sm:inline-flex items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </button>

        <Link
          href="/meetings"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-9 w-full justify-center gap-2 rounded-lg font-medium shadow-none group-data-[collapsible=icon]:px-0"
          )}
        >
          <Plus className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.5} />
          <span className="group-data-[collapsible=icon]:sr-only">New meeting</span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2 pb-4">
        <SidebarGroup className="py-0">
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryNav.map((item) => (
                <NavItem key={item.url} item={item} isActive={linkIsActive(item.url)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-[color:var(--sidebar-border)] px-2 py-3 group-data-[collapsible=icon]:hidden">
        <div className="flex flex-col gap-0.5">
          <form action={signOutAction} className="w-full">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] text-red-400/90 transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut className="h-[15px] w-[15px] shrink-0 opacity-90" strokeWidth={1.5} />
              Sign out
            </button>
          </form>
        </div>
        <p className="mt-2 px-2 text-[10px] leading-relaxed text-[color:var(--muted-foreground)]">
          <kbd className="rounded border border-[color:var(--border)] bg-[color:var(--muted)] px-1 font-mono text-[9px]">⌘</kbd>
          <kbd className="ml-0.5 rounded border border-[color:var(--border)] bg-[color:var(--muted)] px-1 font-mono text-[9px]">K</kbd>{" "}
          command palette
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
