import { requireActiveSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { beginMfaEnrollmentAction, confirmMfaEnrollmentAction, disableMfaAction, revokeUserSessionAction, updateAccountAction } from "@/lib/product-actions";
import { buildOtpAuthUrl } from "@/lib/mfa";
import { decryptMfaSecret } from "@/lib/mfa-encryption";
import { passwordPolicyMessage } from "@/lib/password-policy";

interface AccountPageProps {
  searchParams: Promise<{ saved?: string; error?: string; mfaSetup?: string }>;
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const session = await requireActiveSession();
  const params = await searchParams;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, mfaEnabled: true, mfaSecret: true },
  });
  const sessions = await prisma.userSession.findMany({
    where: { userId: session.user.id },
    orderBy: { lastSeenAt: "desc" },
  });
  const enrollmentSecret = user?.mfaSecret && !user.mfaEnabled ? decryptMfaSecret(user.mfaSecret) : null;
  const otpAuthUrl = enrollmentSecret && user?.email ? buildOtpAuthUrl(user.email, "Drift OS", enrollmentSecret) : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white/90">Account</h1>
        <p className="mt-1 text-sm text-zinc-400">
          This page is backed by the logged-in user record and persisted session state.
        </p>
      </div>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-white/90">Profile</CardTitle>
          <CardDescription>Update the user identity shown in the navigation and audit trail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {params.saved ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              Account changes saved.
            </div>
          ) : null}
          {params.error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {params.error}
            </div>
          ) : null}
          <form action={updateAccountAction} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-zinc-300" htmlFor="name">Display name</label>
                <Input id="name" name="name" defaultValue={session.user.name ?? ""} className="border-white/10 bg-white/5" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-300" htmlFor="email">Email</label>
                <Input id="email" value={session.user.email} readOnly disabled className="border-white/10 bg-white/5 text-zinc-500" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-zinc-300" htmlFor="role">Role</label>
                <Input id="role" value={session.user.role} readOnly disabled className="border-white/10 bg-white/5 text-zinc-500" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-300" htmlFor="avatarUrl">Avatar URL</label>
                <Input id="avatarUrl" name="avatarUrl" defaultValue={session.user.avatarUrl ?? ""} className="border-white/10 bg-white/5" />
              </div>
            </div>
            <Button type="submit">Save account</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-white/90">Multi-Factor Authentication</CardTitle>
          <CardDescription>Optional TOTP-based MFA for this stored account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm text-zinc-300">
            Status: {user?.mfaEnabled ? "Enabled" : "Not enabled"}
          </div>
          {!user?.mfaEnabled && !user?.mfaSecret ? (
            <form action={beginMfaEnrollmentAction}>
              <Button type="submit">Start MFA setup</Button>
            </form>
          ) : null}
          {!user?.mfaEnabled && enrollmentSecret ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm text-zinc-300">
                <div className="font-medium text-white/90">Manual secret</div>
                <div className="mt-1 break-all font-mono text-xs text-zinc-400">{enrollmentSecret}</div>
              </div>
              {otpAuthUrl ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-xs text-zinc-400">
                  Authenticator URL: {otpAuthUrl}
                </div>
              ) : null}
              <form action={confirmMfaEnrollmentAction} className="flex flex-col gap-3 md:flex-row">
                <Input name="code" inputMode="numeric" minLength={6} maxLength={6} required placeholder="Enter 6-digit code" className="border-white/10 bg-white/5" />
                <Button type="submit">Confirm MFA</Button>
              </form>
            </div>
          ) : null}
          {user?.mfaEnabled ? (
            <form action={disableMfaAction}>
              <Button type="submit" variant="outline" className="border-white/10 bg-white/5">
                Disable MFA
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-white/90">Session Control</CardTitle>
          <CardDescription>
            Review and revoke active sessions for this stored account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-zinc-500">{passwordPolicyMessage()}</p>
          {sessions.map((active) => (
            <div key={active.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-zinc-300">
                <div>Created: {new Date(active.createdAt).toLocaleString()}</div>
                <div className="text-zinc-500">Last seen: {new Date(active.lastSeenAt).toLocaleString()}</div>
                <div className="text-zinc-500">Expires: {new Date(active.expiresAt).toLocaleString()}</div>
                <div className="text-zinc-500">IP: {active.ipAddress ?? "Insufficient data"}</div>
                <div className="text-zinc-500">User agent: {active.userAgent ?? "Insufficient data"}</div>
              </div>
              <form action={revokeUserSessionAction}>
                <input type="hidden" name="sessionId" value={active.id} />
                <input type="hidden" name="userId" value={session.user.id} />
                <input type="hidden" name="returnTo" value="/account" />
                <Button type="submit" variant="outline" className="border-white/10 bg-white/5">
                  Revoke session
                </Button>
              </form>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
