import prisma from "@/lib/db";
import { OpportunitiesClient } from "@/components/opportunities-client";

export const revalidate = 0;

export default async function OpportunitiesPage() {
  const opportunities = await prisma.opportunity.findMany({
    where: { status: "DRAFT" },
    include: { client: true },
    orderBy: { createdAt: "desc" }
  });

  return <OpportunitiesClient opportunities={opportunities} />;
}
