import "server-only";

import prisma from "@/lib/db";

export type OrgOperationalFlags = {
  aiFeaturesEnabled: boolean;
  readOnlyMode: boolean;
  /** Basis points; default 50 = 0.5% AUM drift threshold for advisory alerts. */
  syncDriftAlertBps: number;
};

export class OrgOperationalSettings {
  static async get(organizationId: string): Promise<OrgOperationalFlags> {
    try {
      const s = await prisma.organizationSettings.findUnique({
        where: { organizationId },
        select: {
          aiFeaturesEnabled: true,
          readOnlyMode: true,
          syncDriftAlertBps: true,
        },
      });
      return {
        aiFeaturesEnabled: s?.aiFeaturesEnabled ?? true,
        readOnlyMode: s?.readOnlyMode ?? false,
        syncDriftAlertBps: s?.syncDriftAlertBps ?? 50,
      };
    } catch {
      return {
        aiFeaturesEnabled: true,
        readOnlyMode: false,
        syncDriftAlertBps: 50,
      };
    }
  }

  static async assertAiEnabled(organizationId: string): Promise<void> {
    const o = await this.get(organizationId);
    if (!o.aiFeaturesEnabled) {
      throw new Error(
        "AI features are disabled for this organization. Contact your firm administrator to re-enable them.",
      );
    }
  }

  static async assertTradingWritesAllowed(organizationId: string): Promise<void> {
    const o = await this.get(organizationId);
    if (o.readOnlyMode) {
      throw new Error(
        "Trading and custodian order submission are disabled: this organization is in read-only (paper) mode.",
      );
    }
  }
}
