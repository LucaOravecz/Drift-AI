import { redirect } from "next/navigation";
import prisma from "@/lib/db";

export const revalidate = 0;

export default async function ClientPortalIndexPage() {
  const client = await prisma.client.findFirst({
    where: { deletedAt: null },
    orderBy: [{ type: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  if (!client) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0c0f12] px-6 text-[#f5f2ea]">
        <div className="max-w-md rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-2xl font-semibold tracking-[-0.04em]">No clients available</h1>
          <p className="mt-3 text-sm leading-6 text-white/70">
            Seed or import a client record to preview the household portal experience.
          </p>
        </div>
      </main>
    );
  }

  redirect(`/portal/${client.id}`);
}
