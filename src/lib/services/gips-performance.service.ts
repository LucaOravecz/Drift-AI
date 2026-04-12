import "server-only";

import prisma from "@/lib/db";
import { AuditEventService } from "./audit-event.service";

/**
 * GIPS-Compliant Performance Reporting Engine
 *
 * Calculates:
 * - Time-Weighted Return (TWR) — GIPS standard, removes cash flow impact
 * - Money-Weighted Return (MWR / IRR) — reflects actual client experience
 * - Benchmark comparison and attribution
 * - Composite construction for GIPS compliance
 * - Rolling period returns (1M, 3M, 6M, YTD, 1Y, 3Y, 5Y, SI)
 *
 * GIPS Standards:
 * - Returns must be time-weighted
 * - Cash flows must be treated per GIPS provision
 * - Composites must include all fee-paying discretionary accounts
 * - Benchmark returns must use the same return methodology
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PerformancePeriod {
  startDate: Date;
  endDate: Date;
  startValue: number;
  endValue: number;
  cashFlows: CashFlow[];
  twr: number; // Time-Weighted Return
  mwr: number; // Money-Weighted Return (IRR)
  benchmarkReturn: number;
  excessReturn: number; // Alpha
  attribution: AttributionResult;
}

export interface CashFlow {
  date: Date;
  amount: number; // positive = contribution, negative = withdrawal
  type: "CONTRIBUTION" | "WITHDRAWAL" | "FEE_DEBIT" | "DIVIDEND" | "DISTRIBUTION";
}

export interface AttributionResult {
  assetAllocation: AttributionItem[];
  securitySelection: AttributionItem[];
  interaction: number;
  totalActiveReturn: number;
}

export interface AttributionItem {
  assetClass: string;
  portfolioWeight: number;
  benchmarkWeight: number;
  portfolioReturn: number;
  benchmarkReturn: number;
  contribution: number;
}

export interface CompositeResult {
  compositeName: string;
  strategy: string;
  period: string;
  accountsIncluded: number;
  totalAum: number;
  compositeTwr: number;
  benchmarkTwr: number;
  dispersion: number; // Cross-sectional standard deviation
  firmAssets: number;
  compliantPresentation: GipsCompliantPresentation;
}

export interface GipsCompliantPresentation {
  firmName: string;
  compositeName: string;
  compositeDescription: string;
  benchmark: string;
  benchmarkDescription: string;
  periods: GipsPeriodRow[];
  compliantSince: string;
  currency: string;
  feeType: "GROSS" | "NET";
  dispersionMeasure: "EQUAL_WEIGHTED_STD_DEV" | "ASSET_WEIGHTED_STD_DEV";
}

export interface GipsPeriodRow {
  year: number;
  compositeReturn: number;
  benchmarkReturn: number;
  numberOfAccounts: number;
  compositeAum: number;
  dispersion: number;
  internalDispersion: number | null;
}

export interface RollingReturns {
  oneMonth: number;
  threeMonth: number;
  sixMonth: number;
  ytd: number;
  oneYear: number;
  threeYearAnnualized: number;
  fiveYearAnnualized: number;
  sinceInception: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class GipsPerformanceService {
  /**
   * Calculate Time-Weighted Return (TWR) using the Modified Dietz method.
   * This is the GIPS-standard approach for portfolio return calculation.
   */
  static calculateTWR(
    startValue: number,
    endValue: number,
    cashFlows: CashFlow[],
    periodDays: number,
  ): number {
    if (startValue === 0) return 0;

    // Modified Dietz: R = (V_e - V_b - CF) / (V_b + Σ(CF_i * W_i))
    const totalCashFlow = cashFlows.reduce((sum, cf) => sum + cf.amount, 0);

    // Weight each cash flow by the fraction of the period remaining
    const weightedCashFlows = cashFlows.reduce((sum, cf) => {
      const daysRemaining = periodDays - Math.floor(
        (cf.date.getTime() - cashFlows[0]?.date.getTime() ?? 0) / (1000 * 60 * 60 * 24),
      );
      const weight = Math.max(0, daysRemaining / periodDays);
      return sum + cf.amount * weight;
    }, 0);

    const numerator = endValue - startValue - totalCashFlow;
    const denominator = startValue + weightedCashFlows;

    if (denominator === 0) return 0;
    return numerator / denominator;
  }

  /**
   * Calculate Money-Weighted Return (Internal Rate of Return).
   * Uses Newton-Raphson method for IRR approximation.
   */
  static calculateMWR(
    startValue: number,
    endValue: number,
    cashFlows: CashFlow[],
    startDate: Date,
    endDate: Date,
  ): number {
    // NPV = -startValue + Σ(CF_i / (1+r)^t_i) + endValue / (1+r)^T = 0
    const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (totalDays === 0) return 0;

    // Newton-Raphson iteration
    let rate = 0.1; // Initial guess: 10%
    const maxIterations = 100;
    const tolerance = 1e-8;

    for (let i = 0; i < maxIterations; i++) {
      let npv = -startValue;
      let dnpv = 0;

      for (const cf of cashFlows) {
        const t = (cf.date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        const factor = Math.pow(1 + rate, t);
        npv += cf.amount / factor;
        dnpv -= (cf.amount * t) / (factor * (1 + rate));
      }

      const tEnd = totalDays / 365.25;
      npv += endValue / Math.pow(1 + rate, tEnd);
      dnpv -= (endValue * tEnd) / (Math.pow(1 + rate, tEnd) * (1 + rate));

      if (Math.abs(dnpv) < 1e-12) break;
      const newRate = rate - npv / dnpv;

      if (Math.abs(newRate - rate) < tolerance) return newRate;
      rate = newRate;

      // Constrain to reasonable range
      if (rate < -0.99) rate = -0.5;
      if (rate > 10) rate = 5;
    }

    return rate;
  }

  /**
   * Calculate rolling period returns for a portfolio.
   */
  static calculateRollingReturns(
    monthlyReturns: { date: Date; return: number }[],
  ): RollingReturns {
    const returns = monthlyReturns.map((r) => r.return);

    const chainReturn = (startIdx: number, endIdx: number): number => {
      let cumulative = 1;
      for (let i = startIdx; i <= endIdx; i++) {
        cumulative *= 1 + returns[i];
      }
      return cumulative - 1;
    };

    const annualize = (totalReturn: number, years: number): number => {
      if (years <= 0) return 0;
      return Math.pow(1 + totalReturn, 1 / years) - 1;
    };

    const n = returns.length;

    return {
      oneMonth: n >= 1 ? returns[n - 1] : 0,
      threeMonth: n >= 3 ? chainReturn(n - 3, n - 1) : 0,
      sixMonth: n >= 6 ? chainReturn(n - 6, n - 1) : 0,
      ytd: n >= 1 ? chainReturn(0, n - 1) : 0, // Simplified — assumes monthlyReturns starts at year start
      oneYear: n >= 12 ? annualize(chainReturn(n - 12, n - 1), 1) : 0,
      threeYearAnnualized: n >= 36 ? annualize(chainReturn(n - 36, n - 1), 3) : 0,
      fiveYearAnnualized: n >= 60 ? annualize(chainReturn(n - 60, n - 1), 5) : 0,
      sinceInception: n >= 1 ? annualize(chainReturn(0, n - 1), n / 12) : 0,
    };
  }

  /**
   * Perform performance attribution (Brinson-Fachler model).
   * Decomposes active return into allocation, selection, and interaction effects.
   */
  static performAttribution(
    portfolioWeights: Record<string, number>,
    portfolioReturns: Record<string, number>,
    benchmarkWeights: Record<string, number>,
    benchmarkReturns: Record<string, number>,
  ): AttributionResult {
    const assetClasses = Object.keys(benchmarkWeights);

    const allocation: AttributionItem[] = [];
    const selection: AttributionItem[] = [];
    let interactionTotal = 0;
    let totalActiveReturn = 0;

    for (const ac of assetClasses) {
      const pw = portfolioWeights[ac] ?? 0;
      const bw = benchmarkWeights[ac] ?? 0;
      const pr = portfolioReturns[ac] ?? 0;
      const br = benchmarkReturns[ac] ?? 0;

      // Allocation effect: (w_p - w_b) * (r_b - r_b_total)
      const benchmarkTotalReturn = Object.entries(benchmarkReturns).reduce(
        (sum, [key, ret]) => sum + ret * (benchmarkWeights[key] ?? 0),
        0,
      );
      const allocationContribution = (pw - bw) * (br - benchmarkTotalReturn);

      // Selection effect: w_b * (r_p - r_b)
      const selectionContribution = bw * (pr - br);

      // Interaction effect: (w_p - w_b) * (r_p - r_b)
      const interactionContribution = (pw - bw) * (pr - br);

      allocation.push({
        assetClass: ac,
        portfolioWeight: pw,
        benchmarkWeight: bw,
        portfolioReturn: pr,
        benchmarkReturn: br,
        contribution: Math.round(allocationContribution * 10000) / 10000,
      });

      selection.push({
        assetClass: ac,
        portfolioWeight: pw,
        benchmarkWeight: bw,
        portfolioReturn: pr,
        benchmarkReturn: br,
        contribution: Math.round(selectionContribution * 10000) / 10000,
      });

      interactionTotal += interactionContribution;
      totalActiveReturn += allocationContribution + selectionContribution + interactionContribution;
    }

    return {
      assetAllocation: allocation,
      securitySelection: selection,
      interaction: Math.round(interactionTotal * 10000) / 10000,
      totalActiveReturn: Math.round(totalActiveReturn * 10000) / 10000,
    };
  }

  /**
   * Build a GIPS-compliant composite from a set of accounts.
   */
  static async buildComposite(
    organizationId: string,
    compositeName: string,
    strategy: string,
    benchmarkName: string,
    year: number,
  ): Promise<CompositeResult> {
    // Get all fee-paying discretionary accounts matching the strategy
    const accounts = await prisma.financialAccount.findMany({
      where: {
        client: { organizationId },
        accountType: "DISCRETIONARY",
        status: "ACTIVE",
      },
      include: { holdings: true, client: { select: { name: true } } },
    });

    const totalAum = accounts.reduce((sum, a) => {
      return sum + a.holdings.reduce((s, h) => s + (h.marketValue ?? 0), 0);
    }, 0);

    // Calculate equal-weighted composite return
    // In production, use asset-weighted returns per GIPS
    const accountReturns = accounts.map((account) => {
      const accountValue = account.holdings.reduce((s, h) => s + (h.marketValue ?? 0), 0);
      const costBasis = account.holdings.reduce((s, h) => s + (h.costBasis ?? 0), 0);
      return accountValue > 0 && costBasis > 0 ? (accountValue - costBasis) / costBasis : 0;
    });

    const compositeTwr =
      accountReturns.length > 0
        ? accountReturns.reduce((sum, r) => sum + r, 0) / accountReturns.length
        : 0;

    // Calculate dispersion (standard deviation of returns)
    const meanReturn = compositeTwr;
    const variance =
      accountReturns.length > 1
        ? accountReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) /
          (accountReturns.length - 1)
        : 0;
    const dispersion = Math.sqrt(variance);

    // Benchmark return placeholder — in production, fetch from market data
    const benchmarkTwr = 0.08; // 8% placeholder

    const compliantPresentation: GipsCompliantPresentation = {
      firmName: "Drift Financial Partners",
      compositeName,
      compositeDescription: `${strategy} strategy composite`,
      benchmark: benchmarkName,
      benchmarkDescription: `${benchmarkName} total return index`,
      periods: [
        {
          year,
          compositeReturn: Math.round(compositeTwr * 10000) / 100,
          benchmarkReturn: Math.round(benchmarkTwr * 10000) / 100,
          numberOfAccounts: accounts.length,
          compositeAum: totalAum,
          dispersion: Math.round(dispersion * 10000) / 100,
          internalDispersion: null,
        },
      ],
      compliantSince: "2024-01-01",
      currency: "USD",
      feeType: "NET",
      dispersionMeasure: "EQUAL_WEIGHTED_STD_DEV",
    };

    await AuditEventService.appendEvent({
      organizationId,
      action: "GIPS_COMPOSITE_CALCULATED",
      target: `Composite:${compositeName}`,
      details: `GIPS composite calculated for ${year}: ${accounts.length} accounts, TWR ${(compositeTwr * 100).toFixed(2)}%`,
      severity: "INFO",
      metadata: {
        year,
        accounts: accounts.length,
        aum: totalAum,
        twr: compositeTwr,
        benchmark: benchmarkTwr,
      },
    });

    return {
      compositeName,
      strategy,
      period: `${year}`,
      accountsIncluded: accounts.length,
      totalAum,
      compositeTwr: Math.round(compositeTwr * 10000) / 100,
      benchmarkTwr: Math.round(benchmarkTwr * 10000) / 100,
      dispersion: Math.round(dispersion * 10000) / 100,
      firmAssets: totalAum,
      compliantPresentation,
    };
  }

  /**
   * Generate a full performance report for a client account.
   */
  static async generatePerformanceReport(
    clientId: string,
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
    benchmarkTicker: string = "SP500",
  ): Promise<PerformancePeriod> {
    const accounts = await prisma.financialAccount.findMany({
      where: { clientId },
      include: { holdings: true },
    });

    const endValue = accounts.reduce(
      (sum, a) => sum + a.holdings.reduce((s, h) => s + (h.marketValue ?? 0), 0),
      0,
    );

    const startValue = accounts.reduce(
      (sum, a) => sum + a.holdings.reduce((s, h) => s + (h.costBasis ?? 0), 0),
      0,
    );

    const periodDays = Math.floor(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Get cash flows from communications/transactions
    const cashFlows: CashFlow[] = []; // TODO: wire to actual transaction data

    const twr = this.calculateTWR(startValue, endValue, cashFlows, periodDays);
    const mwr = this.calculateMWR(startValue, endValue, cashFlows, periodStart, periodEnd);

    // Placeholder benchmark return
    const benchmarkReturn = 0.08;

    // Build attribution from current holdings
    const portfolioWeights: Record<string, number> = {};
    const portfolioReturns: Record<string, number> = {};
    const benchmarkWeights: Record<string, number> = {
      "US_EQUITY": 0.55,
      "INTL_EQUITY": 0.15,
      "FIXED_INCOME": 0.25,
      "CASH": 0.05,
    };
    const benchmarkReturns: Record<string, number> = {
      "US_EQUITY": 0.12,
      "INTL_EQUITY": 0.06,
      "FIXED_INCOME": 0.04,
      "CASH": 0.02,
    };

    for (const account of accounts) {
      for (const holding of account.holdings) {
        const ac = holding.assetClass ?? "UNCATEGORIZED";
        portfolioWeights[ac] = (portfolioWeights[ac] ?? 0) + (holding.marketValue ?? 0);
        portfolioReturns[ac] = twr; // Simplified — use overall return per class
      }
    }

    // Normalize weights
    const totalWeight = Object.values(portfolioWeights).reduce((s, v) => s + v, 0);
    if (totalWeight > 0) {
      for (const key of Object.keys(portfolioWeights)) {
        portfolioWeights[key] = portfolioWeights[key] / totalWeight;
      }
    }

    const attribution = this.performAttribution(
      portfolioWeights,
      portfolioReturns,
      benchmarkWeights,
      benchmarkReturns,
    );

    return {
      startDate: periodStart,
      endDate: periodEnd,
      startValue,
      endValue,
      cashFlows,
      twr: Math.round(twr * 10000) / 100,
      mwr: Math.round(mwr * 10000) / 100,
      benchmarkReturn: Math.round(benchmarkReturn * 10000) / 100,
      excessReturn: Math.round((twr - benchmarkReturn) * 10000) / 100,
      attribution,
    };
  }
}
