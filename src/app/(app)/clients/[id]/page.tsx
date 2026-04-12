import { notFound } from "next/navigation";
import { ClientService } from "@/lib/services/client.service";
import { ClientDetailClient } from "@/components/client-detail-client";
import { getHouseholdTopology, getAuditTrail } from "@/lib/actions";

export const revalidate = 0;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const client = await ClientService.getClientDetail(id);
  if (!client) notFound();

  // Fetch Institutional Data
  const topology = await getHouseholdTopology(id);
  const auditLogs = await getAuditTrail(id);

  return (
    <ClientDetailClient 
      client={client} 
      topology={topology}
      auditLogs={auditLogs}
    />
  );
}
