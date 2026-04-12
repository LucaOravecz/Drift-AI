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
        <AppSidebar branding={branding} canManageUsers={canManageUsers} />
        <div className="flex flex-1 flex-col overflow-hidden w-full h-screen">
          <TopHeader
            branding={branding}
            currentUser={currentUser}
            summary={summary}
            notifications={notifications}
            unreadCount={unreadCount}
          />
          <main className="flex-1 overflow-y-auto bg-[#09090b] p-6 md:p-8">{children}</main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
