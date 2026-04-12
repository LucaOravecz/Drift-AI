import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/layout/brand-logo";
import { getBranding } from "@/lib/app-shell";
import prisma from "@/lib/db";
import { acceptInviteAction } from "@/lib/product-actions";

interface AcceptInvitePageProps {
  searchParams: Promise<{ token?: string; error?: string }>;
}

export default async function AcceptInvitePage({ searchParams }: AcceptInvitePageProps) {
  const params = await searchParams;
  const token = params.token ?? "";
  const branding = await getBranding();
  const invite = token
    ? await prisma.userInvite.findUnique({
        where: { token },
        include: { user: true },
      })
    : null;
  const invalid = !invite || invite.acceptedAt || invite.expiresAt <= new Date();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.18),_transparent_35%),linear-gradient(180deg,#06070b_0%,#090b10_50%,#050608_100%)] px-6 py-12 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl items-center justify-center">
        <Card className="w-full border-white/10 bg-black/40 shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-4">
            <BrandLogo branding={branding} />
            <div>
              <CardTitle className="text-2xl text-white/90">Accept account invite</CardTitle>
              <CardDescription className="text-zinc-400">
                Set your password to activate the stored account your firm created for you.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {invalid ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm text-red-300">
                Invite is invalid or expired.
              </div>
            ) : (
              <form action={acceptInviteAction} className="space-y-4">
                <input type="hidden" name="token" value={token} />
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-zinc-300">
                  Invited user: {invite.user.email}
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-300" htmlFor="password">Password</label>
                  <Input id="password" name="password" type="password" required className="border-white/10 bg-white/5" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-300" htmlFor="confirmPassword">Confirm password</label>
                  <Input id="confirmPassword" name="confirmPassword" type="password" required className="border-white/10 bg-white/5" />
                </div>
                {params.error ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {params.error}
                  </div>
                ) : null}
                <Button type="submit" className="w-full">Activate account</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
