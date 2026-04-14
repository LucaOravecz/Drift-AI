import "server-only";

import { TLHSweepService } from "./tlh-sweep.service";
import prisma from "@/lib/db";

/**
 * TLH Opportunity Service
 *
 * Bridges the TLH sweep engine with the opportunity detection system.
 * Creates detailed opportunity records with specific swap suggestions.
 */
export class TLHOpportunityService {
  /**
   * Run TLH sweep and create detailed opportunity with swap suggestions
   * Returns null if no harvesting opportunities found
   */
  static async createDetailedTLHOpportunity(clientId: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { accounts: { include: { holdings: true } } }
    });

    if (!client) return null;

    // Run sweep
    const sweep = await TLHSweepService.runSweep(client.organizationId);
    if (sweep.suggestions.length === 0) return null; // No TLH opportunities

    // Format swap summary (top 5 suggestions)
    const swapSummary = sweep.suggestions
      .slice(0, 5)
      .map(
        s =>
          `Sell ${s.lot.ticker} (${s.suggestedAction}, $${s.lot.unrealizedLoss.toLocaleString()}), buy ${s.replacementTicker || "TBD"}`
      )
      .join(" | ");

    // Calculate total tax benefit
    const totalTaxBenefit = sweep.suggestions.reduce(
      (sum, s) => sum + s.estimatedTaxSavings,
      0
    );

    // Create opportunity record
    const washSaleCount = sweep.suggestions.filter(s => !s.washSaleSafe).length;
    const opp = await prisma.opportunity.create({
      data: {
        clientId,
        type: "TLH",
        description: `${sweep.suggestions.length} tax-loss harvesting swaps identified`,
        suggestedAction: swapSummary,
        status: "DRAFT",
        riskLevel: "LOW",
        confidence: 85,
        evidence: "TLH Sweep Engine",
        reasoning: `Identified ${sweep.suggestions.length} harvestable tax-loss positions. Est. tax benefit: $${totalTaxBenefit.toLocaleString()}. Wash-sale risk flagged for ${washSaleCount} position(s).`,
        valueEst: totalTaxBenefit
      }
    });

    return opp;
  }
}
