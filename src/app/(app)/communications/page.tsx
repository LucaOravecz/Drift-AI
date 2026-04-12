import { CommunicationService } from "@/lib/services/communication.service";
import { CommunicationsClient } from "@/components/communications-client";

export const revalidate = 0;

export default async function CommunicationsPage() {
  const [comms, events, stats, clients] = await Promise.all([
    CommunicationService.getCommunications(),
    CommunicationService.getRelationshipEvents(),
    CommunicationService.getStats(),
    (await import("@/lib/db")).default.client.findMany({ select: { id: true, name: true }, take: 20 }),
  ]);
  return <CommunicationsClient comms={comms as any} events={events as any} stats={stats} clients={clients} />;
}
