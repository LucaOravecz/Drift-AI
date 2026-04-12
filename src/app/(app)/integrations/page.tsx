import prisma from "@/lib/db";
import { IntegrationsClient } from "@/components/integrations-client";
import { requireActiveSession } from "@/lib/auth";

export const revalidate = 0;

export default async function IntegrationsPage() {
  const session = await requireActiveSession();
  const integrations = await prisma.integrationConfig.findMany({
    where: { organizationId: session.user.organizationId },
    select: {
      provider: true,
      category: true,
      status: true,
      lastSyncAt: true,
      errorCount: true,
      lastError: true,
    },
    orderBy: { category: "asc" },
  });

  const providers = integrations.map((i) => ({
    ...i,
    lastSyncAt: i.lastSyncAt?.toISOString() ?? null,
  }));

  return <IntegrationsClient providers={providers} />;
}
