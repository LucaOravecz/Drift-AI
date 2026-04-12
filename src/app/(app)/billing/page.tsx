import prisma from "@/lib/db";
import { BillingClient } from "@/components/billing-client";

export const revalidate = 0;

export default async function BillingPage() {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, aum: true },
    orderBy: { aum: "desc" },
  });

  return <BillingClient clients={clients} />;
}
