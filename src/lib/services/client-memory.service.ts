import prisma from "@/lib/db";
import { buildClientMemoryProfile } from "@/lib/engines/client-memory.engine";
import { AuditService } from "@/lib/services/audit.service";

export class ClientMemoryService {
  static async refreshSnapshot(clientId: string) {
    const profile = await buildClientMemoryProfile(clientId);
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, organizationId: true, name: true },
    });

    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    const summary = [
      `Data quality: ${profile.dataQuality}`,
      `Open opportunities: ${profile.activityCounts.openOpportunities}`,
      `Open tasks: ${profile.activityCounts.openTasks}`,
      `Communications in last 90 days: ${profile.activityCounts.communicationsLast90Days}`,
    ].join(" | ");

    const snapshot = await prisma.clientMemorySnapshot.create({
      data: {
        clientId,
        generatedBy: "DETERMINISTIC",
        dataQuality: profile.dataQuality,
        summary,
        payload: JSON.stringify(profile),
        missingData: JSON.stringify(profile.missingData),
      },
    });

    await AuditService.logAction({
      organizationId: client.organizationId,
      action: "CLIENT_MEMORY_REFRESHED",
      target: `Client:${client.id}`,
      details: `Client memory snapshot generated for ${client.name}.`,
      metadata: {
        snapshotId: snapshot.id,
        dataQuality: profile.dataQuality,
        missingData: profile.missingData,
      },
      aiInvolved: false,
      severity: "INFO",
    });

    return { snapshot, profile };
  }

  static async getLatestSnapshot(clientId: string) {
    const snapshot = await prisma.clientMemorySnapshot.findFirst({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });

    if (!snapshot) return null;

    return {
      ...snapshot,
      payload: JSON.parse(String(snapshot.payload)),
      missingData: snapshot.missingData ? JSON.parse(String(snapshot.missingData)) : [],
    };
  }
}
