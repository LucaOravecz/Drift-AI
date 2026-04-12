import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/layout/brand-logo";
import { getBranding } from "@/lib/app-shell";
import { cookies } from "next/headers";
import { MFA_CHALLENGE_COOKIE_NAME } from "@/lib/auth";
import { signOutAction, verifyMfaAction } from "@/lib/product-actions";

interface VerifyMfaPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function VerifyMfaPage({ searchParams }: VerifyMfaPageProps) {
  const challenge = (await cookies()).get(MFA_CHALLENGE_COOKIE_NAME)?.value;
  if (!challenge) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const branding = await getBranding();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.18),_transparent_35%),linear-gradient(180deg,#06070b_0%,#090b10_50%,#050608_100%)] px-6 py-12 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl items-center justify-center">
        <Card className="w-full border-white/10 bg-black/40 shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-4">
            <BrandLogo branding={branding} />
            <div>
              <CardTitle className="text-2xl text-white/90">Verify MFA</CardTitle>
              <CardDescription className="text-zinc-400">
                Enter the 6-digit code from your authenticator app to complete sign-in.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={verifyMfaAction} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-300" htmlFor="code">Authenticator code</label>
                <Input id="code" name="code" required minLength={6} maxLength={6} inputMode="numeric" className="border-white/10 bg-white/5" />
              </div>
              {params.error ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {params.error}
                </div>
              ) : null}
              <Button type="submit" className="w-full">Verify and sign in</Button>
            </form>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" className="w-full border-white/10 bg-white/5">
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
