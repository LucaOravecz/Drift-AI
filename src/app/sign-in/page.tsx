import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getBranding } from "@/lib/app-shell";
import { getActiveSession } from "@/lib/auth";
import { signInAction } from "@/lib/product-actions";

interface SignInPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await getActiveSession();
  if (session) {
    redirect(session.user.mustChangePassword ? "/reset-password" : "/");
  }

  const params = await searchParams;
  const branding = await getBranding();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.25),_transparent_35%),linear-gradient(180deg,#06070b_0%,#090b10_50%,#050608_100%)] px-6 py-12 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.2fr_420px]">
          <section className="hidden rounded-3xl border border-white/10 bg-white/[0.03] p-10 backdrop-blur-xl lg:flex lg:flex-col lg:justify-between">
            <div className="space-y-6">
              <BrandLogo branding={branding} size="lg" />
              <div className="space-y-4">
                <p className="text-sm font-medium uppercase tracking-[0.25em] text-white/40">
                  Product Spine Rebuild
                </p>
                <h1 className="text-4xl font-semibold tracking-tight text-white/90">
                  Real sessions, real settings, real stored outputs.
                </h1>
                <p className="max-w-xl text-sm leading-7 text-zinc-400">
                  Public self-sign-up is disabled. Accounts are provisioned internally, stored in the database, and every user signs in with firm-issued credentials.
                </p>
              </div>
            </div>
          </section>

          <Card className="border-white/10 bg-black/40 shadow-2xl backdrop-blur-xl">
            <CardHeader className="space-y-4">
              <div className="lg:hidden">
                <BrandLogo branding={branding} />
              </div>
              <div>
                <CardTitle className="text-2xl text-white/90">Sign in</CardTitle>
                <CardDescription className="text-zinc-400">
                  Use a stored account to create a session and enter the protected workspace.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form action={signInAction} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-300" htmlFor="email">Email</label>
                  <Input id="email" name="email" type="email" required className="border-white/10 bg-white/5" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-300" htmlFor="password">Password</label>
                  <Input id="password" name="password" type="password" required className="border-white/10 bg-white/5" />
                </div>
                {params.error ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {params.error}
                  </div>
                ) : null}
                <Button type="submit" className="w-full">
                  Sign in
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
