import prisma from "@/lib/db";
import { ProposalsClient } from "@/components/proposals-client";

export const revalidate = 0;

export default async function ProposalsPage() {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, riskProfile: true },
    orderBy: { name: "asc" },
  });

  return <ProposalsClient clients={clients} />;
}
