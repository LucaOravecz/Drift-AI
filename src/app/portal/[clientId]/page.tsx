import { notFound } from "next/navigation";
import { ClientPortalExperienceView } from "@/components/client-portal-experience";
import { ClientPortalService } from "@/lib/services/client-portal.service";

export const revalidate = 0;

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const portal = await ClientPortalService.getClientExperience(clientId);

  if (!portal) {
    notFound();
  }

  return <ClientPortalExperienceView portal={portal} />;
}
