import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Subprocessors | Drift OS",
  description: "Third-party services that may process data on behalf of your Drift OS deployment.",
};

const rows = [
  {
    name: "Hosting & edge",
    vendors: "Vercel (or your chosen host per deployment)",
    purpose: "Application delivery, serverless execution, and static assets.",
  },
  {
    name: "Database",
    vendors: "Managed PostgreSQL provider (e.g. Neon, RDS) per environment",
    purpose: "Primary transactional datastore for the application.",
  },
  {
    name: "AI inference",
    vendors: "OpenRouter / model providers you configure (e.g. Anthropic)",
    purpose: "Optional LLM calls when AI features are enabled for your organization.",
  },
  {
    name: "Email & calendar",
    vendors: "Your configured webhook targets or ESP",
    purpose: "Outbound communications and calendar sync when integration URLs are set.",
  },
  {
    name: "Object storage",
    vendors: "S3-compatible or GCS per your configuration",
    purpose: "Optional document file storage when enabled.",
  },
  {
    name: "Observability",
    vendors: "Sentry or equivalent APM if configured in environment",
    purpose: "Error reporting and performance monitoring.",
  },
] as const;

export default function SubprocessorsPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)] px-6 py-12 text-[color:var(--foreground)]">
      <div
        className="drift-orb pointer-events-none"
        data-orb="teal"
        style={{ width: 280, height: 280, background: "rgba(29,158,117,0.12)", top: -60, right: -40 }}
      />
      <article className="relative z-10 mx-auto max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">Trust & transparency</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white/90">Subprocessors</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          This page describes categories of third parties that may touch customer data when you operate Drift OS.
          Your firm&apos;s actual subprocessors depend on <strong className="text-zinc-300">which products you enable</strong>,{" "}
          <strong className="text-zinc-300">which environment variables and integrations you configure</strong>, and{" "}
          <strong className="text-zinc-300">your infrastructure choices</strong>. Update your customer-facing DPA and privacy
          notices to match your deployment; this list is illustrative, not legal advice.
        </p>

        <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Typical vendors</th>
                <th className="px-4 py-3 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-4 font-medium text-white/85">{row.name}</td>
                  <td className="px-4 py-4 text-zinc-400">{row.vendors}</td>
                  <td className="px-4 py-4 text-zinc-400">{row.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-xs text-zinc-500">
          Firm administrators can disable AI features and enable read-only mode from Settings when your governance policy
          requires it.
        </p>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/sign-in" className="text-emerald-400/90 underline-offset-4 hover:underline">
            Sign in
          </Link>
          <span className="text-zinc-600">·</span>
          <Link href="/" className="text-zinc-400 underline-offset-4 hover:text-zinc-300 hover:underline">
            Home
          </Link>
        </div>
      </article>
    </main>
  );
}
