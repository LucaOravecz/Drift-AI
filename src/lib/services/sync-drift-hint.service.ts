import "server-only";

import prisma from "@/lib/db";
import { OrgOperationalSettings } from "@/lib/org-operational-settings";

/**
 * Lightweight book-vs-AUM drift hint after custodian sync.
 * When custodian truth is wired, replace `bookValue` aggregation with custodian-reported totals.
 */
export class SyncDriftHintService {
  static async evaluateClient(clientId: string, organizationId: string): Promise<{
    alert: boolean;
    message: string;
    bookValue: number;
    aum: number | null;
    thresholdBps: number;
  }> {
    const [client, holdings] = await Promise.all([
      prisma.client.findFirst({
        where: { id: clientId, organizationId },
        select: { aum: true },
      }),
      prisma.holding.findMany({
        where: { account: { clientId } },
        select: { marketValue: true },
      }),
    ]);

    const bookValue = holdings.reduce((s, h) => s + (h.marketValue ?? 0), 0);
    const aum = client?.aum ?? null;
    const { syncDriftAlertBps } = await OrgOperationalSettings.get(organizationId);

    if (aum == null || aum <= 0) {
      return {
        alert: false,
        message: "AUM not set on client record — drift check skipped.",
        bookValue,
        aum,
        thresholdBps: syncDriftAlertBps,
      };
    }

    const driftBps = (Math.abs(bookValue - aum) / aum) * 10_000;
    const alert = driftBps >= syncDriftAlertBps;

    return {
      alert,
      message: alert
        ? `Holdings sum (${bookValue.toFixed(0)}) vs client AUM (${aum.toFixed(0)}) differs by ~${driftBps.toFixed(0)} bps (threshold ${syncDriftAlertBps} bps). Reconcile custodian vs book.`
        : `Book within ${syncDriftAlertBps} bps of recorded AUM.`,
      bookValue,
      aum,
      thresholdBps: syncDriftAlertBps,
    };
  }
}
