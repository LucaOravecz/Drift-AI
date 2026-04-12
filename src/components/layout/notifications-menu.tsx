"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markAllNotificationsReadQuickAction, markNotificationReadByIdAction } from "@/lib/product-actions";

interface NotificationsMenuProps {
  unreadCount: number;
  notifications: {
    id: string;
    title: string;
    body: string;
    status: string;
    link: string | null;
    createdAt: Date;
  }[];
}

export function NotificationsMenu({ unreadCount, notifications }: NotificationsMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleOpenNotification = (notification: NotificationsMenuProps["notifications"][number]) => {
    startTransition(async () => {
      if (notification.status === "UNREAD") {
        await markNotificationReadByIdAction(notification.id);
      }

      router.push(notification.link ?? "/notifications");
      router.refresh();
    });
  };

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllNotificationsReadQuickAction();
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative rounded-full p-2 text-muted-foreground transition hover:bg-white/5 hover:text-foreground">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 border-white/10 bg-zinc-950 text-zinc-100">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            <div className="flex items-center gap-3">
              {unreadCount > 0 ? (
                <button type="button" onClick={handleMarkAllRead} disabled={isPending} className="text-xs text-zinc-400 transition hover:text-white disabled:opacity-50">
                  Mark all read
                </button>
              ) : null}
              <Link href="/notifications" className="text-xs text-primary">
                Open center
              </Link>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-white/10" />
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-sm text-zinc-500">No notifications yet.</div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem key={notification.id} onSelect={(event) => {
              event.preventDefault();
              handleOpenNotification(notification);
            }}>
              <button
                type="button"
                onClick={() => handleOpenNotification(notification)}
                className="flex w-full flex-col items-start gap-1 whitespace-normal px-3 py-3 text-left"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white/90">{notification.title}</span>
                  <span className={`text-[10px] uppercase tracking-wide ${notification.status === "UNREAD" ? "text-amber-300" : "text-zinc-500"}`}>
                    {notification.status}
                  </span>
                </div>
                <p className="text-xs leading-5 text-zinc-400">{notification.body}</p>
                <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                  {new Date(notification.createdAt).toLocaleString()}
                </span>
              </button>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
