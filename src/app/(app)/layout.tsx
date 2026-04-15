import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopHeader } from "@/components/layout/top-header";
import { getBranding, getHeaderSummary, getNotificationsForUser, getUnreadNotificationCount } from "@/lib/app-shell";
import { requireActiveSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireActiveSession();
  if (session.user.mustChangePassword) {
    redirect("/reset-password");
  }
  const [branding, summary, notifications, unreadCount] = await Promise.all([
    getBranding(session.user.organizationId),
    getHeaderSummary(session.user.organizationId, session.user.id),
    getNotificationsForUser(session.user.id, 6),
    getUnreadNotificationCount(session.user.id),
  ]);

  const currentUser = {
    name: session.user.name ?? session.user.email,
    email: session.user.email,
    role: session.user.role,
    avatarUrl: session.user.avatarUrl,
  };
  const canManageUsers = ["ADMIN", "SENIOR_ADVISOR"].includes(session.user.role);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="relative flex h-screen w-full flex-1 overflow-hidden" style={{ background: "var(--background)" }}>
          <div
            className="drift-orb"
            data-orb="teal"
            style={{
              width: "400px",
              height: "400px",
              background: "rgba(29,158,117,0.12)",
              top: "-120px",
              right: "-80px",
              animationDelay: "0s",
            }}
          />
          <div
            className="drift-orb"
            data-orb="blue"
            style={{
              width: "300px",
              height: "300px",
              background: "rgba(55,138,221,0.09)",
              bottom: "0",
              left: "200px",
              animationDelay: "-4s",
            }}
          />
          <AppSidebar branding={branding} canManageUsers={canManageUsers} />
          <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
            <TopHeader
              branding={branding}
              currentUser={currentUser}
              summary={summary}
              notifications={notifications}
              unreadCount={unreadCount}
            />
            <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
