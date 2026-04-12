import { requireActiveSession } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getBranding } from "@/lib/app-shell";
import Link from "next/link";
import prisma from "@/lib/db";
import { IntegrationService } from "@/lib/services/integration.service";
import { createManagedUserAction, resetManagedUserPasswordAction, setManagedUserStatusAction, updateIntegrationSettingsAction, updateSettingsAction } from "@/lib/product-actions";

interface SettingsPageProps {
  searchParams: Promise<{ saved?: string; userSaved?: string; error?: string }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await requireActiveSession();
  const branding = await getBranding(session.user.organizationId);
  const params = await searchParams;
  const preferences = session.user.preferences;
  const canManageUsers = ["ADMIN", "SENIOR_ADVISOR"].includes(session.user.role);
  const [integrationStatus, organizationSettings, managedUsers] = await Promise.all([
    IntegrationService.getStatus(session.user.organizationId),
    prisma.organizationSettings.findUnique({
      where: { organizationId: session.user.organizationId },
    }),
    canManageUsers
      ? prisma.user.findMany({
          where: { organizationId: session.user.organizationId },
          orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white/90">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Branding and notification preferences are stored in the database and immediately reflected in the protected shell.
        </p>
      </div>

      {params.saved ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Settings saved.
        </div>
      ) : null}

      {params.userSaved ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          User access settings saved.
        </div>
      ) : null}

      {params.error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {params.error}
        </div>
      ) : null}

      <form action={updateSettingsAction} className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-white/90">Branding</CardTitle>
            <CardDescription>
              Exact inputs: brand name, short name, tagline, logo path, accent color, support contacts.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-zinc-300" htmlFor="brandName">Brand name</label>
              <Input id="brandName" name="brandName" defaultValue={branding.wordmark} className="border-white/10 bg-white/5" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-300" htmlFor="brandShortName">Short name</label>
              <Input id="brandShortName" name="brandShortName" defaultValue={branding.shortName} className="border-white/10 bg-white/5" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-300" htmlFor="productName">Product name</label>
              <Input id="productName" name="productName" defaultValue={branding.productName} className="border-white/10 bg-white/5" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-300" htmlFor="accentColor">Accent color</label>
              <Input id="accentColor" name="accentColor" defaultValue={branding.accentColor} className="border-white/10 bg-white/5" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-zinc-300" htmlFor="tagline">Tagline</label>
              <Input id="tagline" name="tagline" defaultValue={branding.tagline} className="border-white/10 bg-white/5" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-zinc-300" htmlFor="logoUrl">Logo image path</label>
              <Input id="logoUrl" name="logoUrl" defaultValue={branding.logoImagePath ?? ""} className="border-white/10 bg-white/5" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-300" htmlFor="supportEmail">Support email</label>
              <Input id="supportEmail" name="supportEmail" defaultValue={branding.supportEmail ?? ""} className="border-white/10 bg-white/5" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-300" htmlFor="notificationsEmail">Notifications email</label>
              <Input id="notificationsEmail" name="notificationsEmail" defaultValue={branding.notificationsEmail ?? ""} className="border-white/10 bg-white/5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-white/90">User Preferences</CardTitle>
            <CardDescription>
              Exact inputs: timezone, locale, and notification delivery preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-zinc-300" htmlFor="timezone">Timezone</label>
              <Input id="timezone" name="timezone" defaultValue={preferences?.timezone ?? "America/Chicago"} className="border-white/10 bg-white/5" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-300" htmlFor="locale">Locale</label>
              <Input id="locale" name="locale" defaultValue={preferences?.locale ?? "en-US"} className="border-white/10 bg-white/5" />
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
              <input id="emailNotifications" name="emailNotifications" type="checkbox" defaultChecked={preferences?.emailNotifications ?? true} />
              <span className="text-sm text-zinc-300">Email notifications</span>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
              <input id="inAppNotifications" name="inAppNotifications" type="checkbox" defaultChecked={preferences?.inAppNotifications ?? true} />
              <span className="text-sm text-zinc-300">In-app notifications</span>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
              <input id="weeklyDigest" name="weeklyDigest" type="checkbox" defaultChecked={preferences?.weeklyDigest ?? false} />
              <span className="text-sm text-zinc-300">Weekly digest</span>
            </label>
            <Button type="submit" className="w-full">Save settings</Button>
          </CardContent>
        </Card>
      </form>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-white/90">Integrations</CardTitle>
          <CardDescription>
            Store setup values here so invite links, outbound email, and calendar sync can work without editing local code. Environment variables still act as fallback.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className={`rounded-xl border px-3 py-3 text-sm ${integrationStatus.appBaseUrlSource === "DATABASE" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/[0.02] text-zinc-300"}`}>
              App base URL
              <div className="mt-1 text-xs text-zinc-400">{integrationStatus.appBaseUrlSource}</div>
            </div>
            <div className={`rounded-xl border px-3 py-3 text-sm ${integrationStatus.emailConfigured ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>
              Email delivery
              <div className="mt-1 text-xs text-zinc-400">{integrationStatus.emailConfigured ? integrationStatus.emailSource : "UNCONFIGURED"}</div>
            </div>
            <div className={`rounded-xl border px-3 py-3 text-sm ${integrationStatus.calendarConfigured ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>
              Calendar sync
              <div className="mt-1 text-xs text-zinc-400">{integrationStatus.calendarConfigured ? integrationStatus.calendarSource : "UNCONFIGURED"}</div>
            </div>
          </div>

          <form action={updateIntegrationSettingsAction} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-zinc-300" htmlFor="appBaseUrl">App base URL</label>
              <Input
                id="appBaseUrl"
                name="appBaseUrl"
                defaultValue={organizationSettings?.appBaseUrl ?? ""}
                placeholder="https://app.yourfirm.com"
                className="border-white/10 bg-white/5"
              />
              <p className="text-xs text-zinc-500">Used for invite links and any user-facing URLs generated by the system.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-300" htmlFor="emailDeliveryWebhookUrl">Email delivery webhook URL</label>
              <Input
                id="emailDeliveryWebhookUrl"
                name="emailDeliveryWebhookUrl"
                defaultValue={organizationSettings?.emailDeliveryWebhookUrl ?? ""}
                placeholder="https://your-email-service.example.com/webhooks/drift"
                className="border-white/10 bg-white/5"
              />
              <p className="text-xs text-zinc-500">Receives outbound email requests for invites and system-generated communications.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-300" htmlFor="calendarSyncWebhookUrl">Calendar sync webhook URL</label>
              <Input
                id="calendarSyncWebhookUrl"
                name="calendarSyncWebhookUrl"
                defaultValue={organizationSettings?.calendarSyncWebhookUrl ?? ""}
                placeholder="https://your-calendar-service.example.com/webhooks/drift"
                className="border-white/10 bg-white/5"
              />
              <p className="text-xs text-zinc-500">Receives sync requests and returns meetings that match stored clients.</p>
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Save integration settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {canManageUsers ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-white/10 bg-white/[0.03] xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-white/90">Access Management</CardTitle>
              <CardDescription>
                User provisioning and session governance now live in a dedicated admin workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <p className="text-sm text-zinc-400">
                Use the dedicated admin page for stored-account creation, access status changes, password resets, and session revocation.
              </p>
              <Link href="/admin/users" className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Open Admin Users
              </Link>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-white/90">Provision Stored Accounts</CardTitle>
              <CardDescription>
                Public sign-up is disabled. Create users here, assign a role, and provide a temporary password through your firm process.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={createManagedUserAction} className="space-y-4">
                <input type="hidden" name="returnTo" value="/settings" />
                <div className="space-y-2">
                  <label className="text-sm text-zinc-300" htmlFor="managedName">Full name</label>
                  <Input id="managedName" name="name" className="border-white/10 bg-white/5" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-300" htmlFor="managedEmail">Email</label>
                  <Input id="managedEmail" name="email" type="email" required className="border-white/10 bg-white/5" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-300" htmlFor="managedRole">Role</label>
                  <select id="managedRole" name="role" defaultValue="ADVISOR" className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200">
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
                  <Input id="temporaryPassword" name="temporaryPassword" type="password" minLength={12} required className="border-white/10 bg-white/5" />
                </div>
                <Button type="submit" className="w-full">Create stored account</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-white/90">Team Access</CardTitle>
              <CardDescription>
                Activate, deactivate, and reset stored passwords. Any admin reset forces a new password on next sign-in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {managedUsers.map((user) => (
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
                        <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-300">Password reset required</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
                    <form action={setManagedUserStatusAction} className="flex gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="nextStatus" value={user.isActive ? "INACTIVE" : "ACTIVE"} />
                      <input type="hidden" name="returnTo" value="/settings" />
                      <Button type="submit" variant="outline" className="border-white/10 bg-white/5">
                        {user.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </form>
                    <form action={resetManagedUserPasswordAction} className="flex flex-1 flex-col gap-2 sm:flex-row">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="returnTo" value="/settings" />
                      <Input
                        name="temporaryPassword"
                        type="password"
                        minLength={12}
                        required
                        placeholder="New temporary password"
                        className="border-white/10 bg-white/5"
                      />
                      <Button type="submit">Reset password</Button>
                    </form>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
