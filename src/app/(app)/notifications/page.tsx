import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireActiveSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/product-actions";

export default async function NotificationsPage() {
  const session = await requireActiveSession();
  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white/90">Notifications</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Stored database notifications for the current user. If no notification exists, the product should not imply otherwise.
          </p>
        </div>
        <form action={markAllNotificationsReadAction}>
          <Button type="submit" variant="outline" className="border-white/10 bg-white/5">
            Mark all as read
          </Button>
        </form>
      </div>

      <div className="grid gap-4">
        {notifications.length === 0 ? (
          <Card className="border-white/10 bg-white/[0.03]">
            <CardContent className="py-10 text-sm text-zinc-500">
              Insufficient data: no notifications are stored for this account yet.
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card key={notification.id} className="border-white/10 bg-white/[0.03]">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-white/90">{notification.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {new Date(notification.createdAt).toLocaleString()} • {notification.type}
                    </CardDescription>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                    notification.status === "UNREAD"
                      ? "bg-amber-500/10 text-amber-300"
                      : "bg-zinc-500/10 text-zinc-400"
                  }`}>
                    {notification.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <p className="text-sm leading-6 text-zinc-300">{notification.body}</p>
                <div className="flex gap-3">
                  {notification.link ? (
                    <Link
                      href={notification.link}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
                    >
                      Open
                    </Link>
                  ) : null}
                  {notification.status === "UNREAD" ? (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <Button type="submit">Mark read</Button>
                    </form>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
