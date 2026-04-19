"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/product-actions";

interface AccountMenuProps {
  currentUser: {
    name: string;
    email: string;
    role: string;
    avatarUrl: string | null;
  };
  summary: {
    clientCount: number;
    unreadNotificationCount: number;
    activeSessionCount: number;
  };
}

export function AccountMenu({ currentUser, summary }: AccountMenuProps) {
  const initials = currentUser.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-left transition hover:bg-white/[0.08]">
        <Avatar className="h-8 w-8">
          <AvatarImage src={currentUser.avatarUrl ?? undefined} alt={currentUser.name} />
          <AvatarFallback>{initials || "DU"}</AvatarFallback>
        </Avatar>
        <div className="hidden min-w-0 sm:block">
          <div className="truncate text-sm font-medium text-white/90">{currentUser.name}</div>
          <div className="truncate text-xs text-zinc-500">
            {currentUser.role} • {summary.clientCount} clients
          </div>
        </div>
        <ChevronDown className="h-4 w-4 text-zinc-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 border-white/10 bg-zinc-950 text-zinc-100">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="space-y-1">
            <div className="text-sm font-medium">{currentUser.name}</div>
            <div className="text-xs font-normal text-zinc-500">{currentUser.email}</div>
            <div className="pt-2 text-[11px] text-zinc-400">
              {summary.clientCount} clients • {summary.unreadNotificationCount} unread notifications • {summary.activeSessionCount} active sessions
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-white/10" />
        <form action={signOutAction}>
          <button type="submit" className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-red-300 transition hover:bg-white/5">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
