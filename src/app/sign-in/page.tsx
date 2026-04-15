import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
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
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)] px-6 py-8 text-[color:var(--foreground)]">
      <div
        className="drift-orb"
        data-orb="teal"
        style={{ width: 320, height: 320, background: "rgba(29,158,117,0.18)", top: -80, right: -60 }}
      />
      <div
        className="drift-orb"
        data-orb="blue"
        style={{ width: 260, height: 260, background: "rgba(55,138,221,0.14)", bottom: 40, left: -60, animationDelay: "-3s" }}
      />
      <div
        className="drift-orb"
        data-orb="coral"
        style={{ width: 180, height: 180, background: "rgba(213,90,48,0.10)", top: "40%", right: "15%", animationDelay: "-5s" }}
      />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full flex-1 items-center justify-center">
          <div className="grid w-full items-stretch gap-8 lg:grid-cols-[1.15fr_430px]">
            <section className="glass-bright hidden min-h-[620px] overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between">
              <div className="space-y-8">
                <BrandLogo branding={branding} size="lg" />
                <div className="max-w-2xl space-y-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-[color:var(--muted-foreground)]">
                    AI Operating System for Financial Firms
                  </p>
                  <h1 className="max-w-xl text-balance text-5xl font-light tracking-[-0.05em] text-[color:var(--foreground)]">
                    Calm infrastructure for advisors who need answers before clients ask.
                  </h1>
                  <p className="max-w-xl text-sm leading-7 text-[color:var(--muted-foreground)]">
                    Accounts are provisioned internally by your firm. Every session, recommendation, and operating surface is grounded in stored client data instead of disposable prompts.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-[#1D9E75]" />
                  <p className="text-sm text-[color:var(--foreground)]">Client memory that compounds over time</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-[#1D9E75]" />
                  <p className="text-sm text-[color:var(--foreground)]">Autonomous compliance, zero manual scanning</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-[#1D9E75]" />
                  <p className="text-sm text-[color:var(--foreground)]">Tax alpha surfaced before your clients ask</p>
                </div>
                <p className="pt-8 text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                  Accounts provisioned internally by your firm
                </p>
              </div>
            </section>

            <section className="glass animate-fade-up relative overflow-hidden p-7 sm:p-8">
              <div className="absolute inset-x-8 top-0 h-px bg-white/15 opacity-60" />
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="lg:hidden">
                    <BrandLogo branding={branding} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-normal tracking-[-0.04em] text-[color:var(--foreground)]">Sign in</h2>
                    <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                      Use your firm-issued credentials to enter the protected workspace.
                    </p>
                  </div>
                </div>

                <form action={signInAction} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-[color:var(--foreground)]" htmlFor="email">Email</label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="advisor@yourfirm.com"
                      className="h-11 rounded-xl border-[0.5px] px-3.5 text-sm"
                      style={{
                        background: "color-mix(in srgb, var(--input) 100%, transparent)",
                        borderColor: "color-mix(in srgb, var(--border) 150%, transparent)",
                        color: "var(--foreground)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-[color:var(--foreground)]" htmlFor="password">Password</label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      className="h-11 rounded-xl border-[0.5px] px-3.5 text-sm"
                      style={{
                        background: "color-mix(in srgb, var(--input) 100%, transparent)",
                        borderColor: "color-mix(in srgb, var(--border) 150%, transparent)",
                        color: "var(--foreground)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                      }}
                    />
                  </div>
                  {params.error ? (
                    <div
                      className="rounded-2xl px-4 py-3 text-sm"
                      style={{
                        background: "rgba(216,90,48,0.12)",
                        border: "0.5px solid rgba(216,90,48,0.28)",
                        color: "color-mix(in srgb, var(--destructive) 72%, white 20%)",
                      }}
                    >
                      {params.error}
                    </div>
                  ) : null}
                  <Button
                    type="submit"
                    className="h-11 w-full rounded-full border-0 text-sm font-medium text-white hover:opacity-90 active:scale-[0.97]"
                    style={{
                      background: "#1D9E75",
                      boxShadow: "0 18px 32px -20px rgba(29,158,117,0.72), inset 0 1px 0 rgba(255,255,255,0.16)",
                    }}
                  >
                    Sign in
                  </Button>
                  <div className="flex justify-end">
                    <span className="text-xs text-[color:var(--muted-foreground)]">Forgot password? Contact your firm admin.</span>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
