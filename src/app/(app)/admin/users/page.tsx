import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { requireActiveSession } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createManagedUserAction, resetManagedUserPasswordAction, revokeUserInviteAction, revokeUserSessionAction, sendUserInviteAction, setManagedUserStatusAction } from "@/lib/product-actions";
import { passwordPolicyMessage } from "@/lib/password-policy";
import { IntegrationService } from "@/lib/services/integration.service";

interface AdminUsersPageProps {
  searchParams: Promise<{ userSaved?: string; error?: string; saved?: string }>;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const session = await requireActiveSession();
  const canManageUsers = ["ADMIN", "SENIOR_ADVISOR"].includes(session.user.role);
  if (!canManageUsers) {
    redirect("/");
  }

  const params = await searchParams;
  const [integrationStatus, users, activeSessions, pendingInvites] = await Promise.all([
    IntegrationService.getStatus(session.user.organizationId),
    prisma.user.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    }),
    prisma.userSession.findMany({
      where: { user: { organizationId: session.user.organizationId } },
      include: { user: true },
      orderBy: { lastSeenAt: "desc" },
    }),
    prisma.userInvite.findMany({
      where: {
        user: { organizationId: session.user.organizationId },
        acceptedAt: null,
      },
      include: { user: true, invitedBy: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white/90">Admin Users</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Stored account provisioning, access status, password resets, and live session control for firm-issued users.
        </p>
      </div>

      {params.userSaved || params.saved ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          User access change saved.
        </div>
      ) : null}

      {params.error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {params.error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-white/90">Provision Stored Account</CardTitle>
            <CardDescription>
              No public registration. Create users here and deliver temporary credentials through your firm workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={createManagedUserAction} className="space-y-4">
              <input type="hidden" name="returnTo" value="/admin/users" />
              <div className="space-y-2">
                <label className="text-sm text-zinc-300" htmlFor="name">Full name</label>
                <Input id="name" name="name" className="border-white/10 bg-white/5" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-300" htmlFor="email">Email</label>
                <Input id="email" name="email" type="email" required className="border-white/10 bg-white/5" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-300" htmlFor="role">Role</label>
                <select id="role" name="role" defaultValue="ADVISOR" className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200">
                  <option value="ADVISOR">Advisor</option>
                  <option value="SENIOR_ADVISOR">Senior Advisor</option>
                  <option value="COMPLIANCE_OFFICER">Compliance Officer</option>
                  <option value="ANALYST">Analyst</option>
                  <option value="READ_ONLY">Read Only</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-300" htmlFor="temporaryPassword">Temporary password</label>
                <Input id="temporaryPassword" name="temporaryPassword" type="password" required className="border-white/10 bg-white/5" />
                <p className="text-xs text-zinc-500">{passwordPolicyMessage()}</p>
              </div>
              <Button type="submit" className="w-full">Create stored account</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-white/90">Firm Access Control</CardTitle>
            <CardDescription>
              Activate, deactivate, and reset passwords. Resetting a password revokes existing sessions and forces a new password on next sign-in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {users.map((user) => {
              const userSessions = activeSessions.filter((item) => item.userId === user.id);
              return (
                <div key={user.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-medium text-white/90">{user.name ?? user.email}</div>
                      <div className="text-xs text-zinc-500">{user.email} • {user.role}</div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide">
                      <span className={`rounded-full px-2 py-1 ${user.isActive ? "bg-emerald-500/10 text-emerald-300" : "bg-zinc-500/10 text-zinc-400"}`}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                      {user.mustChangePassword ? (
                        <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-300">Reset required</span>
                      ) : null}
                      <span className="rounded-full bg-white/5 px-2 py-1 text-zinc-400">
                        {userSessions.length} session{userSessions.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
                    <form action={setManagedUserStatusAction} className="flex gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="nextStatus" value={user.isActive ? "INACTIVE" : "ACTIVE"} />
                      <input type="hidden" name="returnTo" value="/admin/users" />
                      <Button type="submit" variant="outline" className="border-white/10 bg-white/5">
                        {user.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </form>
                    <form action={resetManagedUserPasswordAction} className="flex flex-1 flex-col gap-2 sm:flex-row">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="returnTo" value="/admin/users" />
                      <Input
                        name="temporaryPassword"
                        type="password"
                        required
                        placeholder="New temporary password"
                        className="border-white/10 bg-white/5"
                      />
                      <Button type="submit">Reset password</Button>
                    </form>
                    <form action={sendUserInviteAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="returnTo" value="/admin/users" />
                      <Button type="submit" variant="outline" className="border-white/10 bg-white/5">
                        Send invite
                      </Button>
                    </form>
                  </div>

                  {userSessions.length > 0 ? (
                    <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600">Active sessions</div>
                      {userSessions.map((active) => (
                        <div key={active.id} className="flex flex-col gap-2 rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-xs text-zinc-400 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div>Created {new Date(active.createdAt).toLocaleString()}</div>
                            <div>Last seen {new Date(active.lastSeenAt).toLocaleString()}</div>
                            <div>IP {active.ipAddress ?? "Insufficient data"}</div>
                            <div>User agent {active.userAgent ?? "Insufficient data"}</div>
                          </div>
                          <form action={revokeUserSessionAction}>
                            <input type="hidden" name="sessionId" value={active.id} />
                            <input type="hidden" name="userId" value={user.id} />
                            <input type="hidden" name="returnTo" value="/admin/users" />
                            <Button type="submit" variant="outline" className="border-white/10 bg-white/5">
                              Revoke session
                            </Button>
                          </form>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-white/90">Pending Invites</CardTitle>
          <CardDescription>
            Stored invite links remain available here even when outbound email is not configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`rounded-xl border px-3 py-3 text-sm ${integrationStatus.emailConfigured ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>
            {integrationStatus.emailConfigured
              ? "Email delivery is configured. Invite links are still shown here for auditability."
              : "Email delivery is not configured. Copy these invite links manually and deliver them through your firm process."}
          </div>
          {pendingInvites.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm text-zinc-400">
              No pending invites.
            </div>
          ) : (
            pendingInvites.map((invite) => {
              const inviteUrl = `${integrationStatus.appBaseUrl}/accept-invite?token=${invite.token}`;
              return (
                <div key={invite.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-medium text-white/90">{invite.user.name ?? invite.email}</div>
                      <div className="text-xs text-zinc-500">
                        {invite.email} • created by {invite.invitedBy.name ?? invite.invitedBy.email}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-500">
                      Expires {new Date(invite.expiresAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <label className="text-[10px] uppercase tracking-wider text-zinc-600" htmlFor={`invite-${invite.id}`}>
                      Invite URL
                    </label>
                    <Input id={`invite-${invite.id}`} readOnly value={inviteUrl} className="border-white/10 bg-white/5 text-zinc-300" />
                  </div>
                  <div className="mt-4 flex justify-end">
                    <form action={revokeUserInviteAction}>
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <input type="hidden" name="returnTo" value="/admin/users" />
                      <Button type="submit" variant="outline" className="border-white/10 bg-white/5">
                        Revoke invite
                      </Button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
