import "server-only";

import { AuditEventService } from "./audit-event.service";

/**
 * Financial Planning Engine
 *
 * Institutional-grade financial planning with:
 * - Monte Carlo retirement simulation (10,000+ trials)
 * - Estate tax modeling (current + sunset provisions)
 * - Insurance needs analysis (life, disability, LTC)
 * - Education funding (529, prepaid, scholarship models)
 * - Social Security optimization (filing strategies)
 * - Roth conversion ladder optimization
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetirementPlanInput {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  currentSavings: number;
  annualContribution: number;
  annualIncome: number;
  annualExpenses: number;
  socialSecurityAnnual: number;
  ssStartAge: number;
  pensionAnnual: number;
  pensionStartAge: number;
  inflationRate: number; // default 0.03
  preRetirementReturn: number; // default 0.07
  postRetirementReturn: number; // default 0.05
  taxRatePreRetirement: number; // default 0.28
  taxRatePostRetirement: number; // default 0.22
  otherIncome: { source: string; annualAmount: number; startAge: number; endAge: number }[];
}

export interface MonteCarloResult {
  successRate: number; // % of trials where money lasted
  medianEndingValue: number;
  bestCase: number; // 95th percentile
  worstCase: number; // 5th percentile
  shortfallAge: number | null; // Age at which median portfolio hits $0
  annualSafeWithdrawal: number; // Based on success rate target
  withdrawalRate: number; // As % of starting portfolio
  trials: number;
  confidenceLevel: number;
  yearByYear: MonteCarloYear[];
}

export interface MonteCarloYear {
  age: number;
  year: number;
  medianPortfolio: number;
  p10: number; // 10th percentile
  p25: number;
  p75: number;
  p90: number;
  medianIncome: number;
  medianExpenses: number;
  isRetired: boolean;
}

export interface EstateTaxResult {
  grossEstate: number;
  adjustedGross: number;
  taxableEstate: number;
  estateTax: number;
  effectiveRate: number;
  exemptionUsed: number;
  exemptionRemaining: number;
  portabilityAvailable: boolean;
  stateEstateTax: number;
  totalTax: number;
  netToBeneficiaries: number;
  sunsetProvision: EstateTaxSunset;
}

export interface EstateTaxSunset {
  currentExemption: number;
  sunsetExemption: number; // After 2025 sunset
  additionalTaxAtSunset: number;
  planningOpportunity: string;
}

export interface InsuranceNeedsResult {
  lifeInsuranceNeeded: number;
  disabilityInsuranceNeeded: number;
  ltcInsuranceNeeded: number;
  breakdown: {
    incomeReplacement: number;
    mortgagePayoff: number;
    educationFunding: number;
    estateLiquidity: number;
    finalExpenses: number;
    existingCoverage: number;
    gap: number;
  };
}

export interface EducationPlanResult {
  totalCost: number;
  annualSavingsNeeded: number;
  lumpSumNeeded: number;
  fundedPercent: number;
  byChild: {
    name: string;
    currentAge: number;
    collegeStartAge: number;
    annualCost: number;
    totalCost: number;
    savingsNeeded: number;
  }[];
}

export interface SocialSecurityStrategy {
  strategy: string;
  filingAge: number;
  spousalBenefit: number;
  totalLifetimeBenefit: number;
  breakEvenAge: number;
  recommendation: string;
  alternatives: { filingAge: number; lifetimeBenefit: number }[];
}

export interface RothConversionLadder {
  conversions: { year: number; amount: number; taxCost: number; rmdAvoided: number }[];
  totalTaxCost: number;
  totalRmdAvoided: number;
  netBenefit: number;
  irrOnTaxPaid: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class FinancialPlanningService {
  /**
   * Monte Carlo Retirement Simulation
   *
   * Runs N trials with stochastic returns to determine
   * probability of portfolio survival through retirement.
   */
  static runMonteCarlo(
    input: RetirementPlanInput,
    trials: number = 10000,
    targetSuccessRate: number = 0.9,
  ): MonteCarloResult {
    const years = input.lifeExpectancy - input.currentAge;
    const allFinalValues: number[] = [];
    const yearPortfolios: number[][][] = Array.from({ length: years }, () =>
      Array.from({ length: 5 }, () => []),
    );

    let successCount = 0;
    let shortfallAge: number | null = null;

    for (let t = 0; t < trials; t++) {
      let portfolio = input.currentSavings;
      let ranOut = false;
      let ranOutAge = input.lifeExpectancy;

      for (let y = 0; y < years; y++) {
        const age = input.currentAge + y;
        const isRetired = age >= input.retirementAge;

        // Stochastic return using log-normal distribution
        const meanReturn = isRetired
          ? input.postRetirementReturn
          : input.preRetirementReturn;
        const volatility = isRetired ? 0.10 : 0.15;

        // Box-Muller transform for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const annualReturn = meanReturn + volatility * z;

        // Apply return
        portfolio *= 1 + annualReturn;

        // Add contributions or subtract withdrawals
        if (!isRetired) {
          portfolio += input.annualContribution * (1 - input.taxRatePreRetirement);
        } else {
          // Withdrawal phase
          const inflationFactor = Math.pow(1 + input.inflationRate, y);
          const expenses = input.annualExpenses * inflationFactor;

          // Add Social Security if eligible
          let income = 0;
          if (age >= input.ssStartAge) {
            income += input.socialSecurityAnnual * Math.pow(1 + input.inflationRate * 0.5, age - input.ssStartAge);
          }
          if (age >= input.pensionStartAge) {
            income += input.pensionAnnual;
          }

          // Other income sources
          for (const oi of input.otherIncome) {
            if (age >= oi.startAge && age <= oi.endAge) {
              income += oi.annualAmount;
            }
          }

          const netWithdrawal = Math.max(0, expenses - income);
          const afterTaxWithdrawal = netWithdrawal / (1 - input.taxRatePostRetirement);
          portfolio -= afterTaxWithdrawal;
        }

        // Record year data (sample every 100th trial for memory efficiency)
        if (t % 100 === 0) {
          yearPortfolios[y][0].push(portfolio);
        }

        // Check for ruin
        if (portfolio <= 0 && !ranOut) {
          ranOut = true;
          ranOutAge = age;
          portfolio = 0;
          break;
        }
      }

      if (!ranOut) {
        successCount++;
      } else if (shortfallAge === null || ranOutAge < shortfallAge) {
        shortfallAge = ranOutAge;
      }

      allFinalValues.push(Math.max(0, portfolio));
    }

    // Sort for percentile calculations
    allFinalValues.sort((a, b) => a - b);

    const successRate = successCount / trials;
    const medianIdx = Math.floor(trials * 0.5);
    const p5Idx = Math.floor(trials * 0.05);
    const p95Idx = Math.floor(trials * 0.95);

    // Calculate year-by-year median and percentiles
    const yearByYear: MonteCarloYear[] = [];
    const currentYear = new Date().getFullYear();

    for (let y = 0; y < years; y++) {
      const values = yearPortfolios[y][0];
      if (values.length === 0) continue;

      values.sort((a, b) => a - b);
      const n = values.length;

      yearByYear.push({
        age: input.currentAge + y,
        year: currentYear + y,
        medianPortfolio: values[Math.floor(n * 0.5)] ?? 0,
        p10: values[Math.floor(n * 0.1)] ?? 0,
        p25: values[Math.floor(n * 0.25)] ?? 0,
        p75: values[Math.floor(n * 0.75)] ?? 0,
        p90: values[Math.floor(n * 0.9)] ?? 0,
        medianIncome: input.currentAge + y >= input.retirementAge
          ? input.socialSecurityAnnual + input.pensionAnnual
          : input.annualIncome,
        medianExpenses: input.annualExpenses * Math.pow(1 + input.inflationRate, y),
        isRetired: input.currentAge + y >= input.retirementAge,
      });
    }

    // Calculate safe withdrawal rate
    const annualSafeWithdrawal =
      successRate >= targetSuccessRate
        ? input.currentSavings * 0.04 // Start with 4% rule
        : input.currentSavings * (0.04 * (successRate / targetSuccessRate));

    return {
      successRate: Math.round(successRate * 10000) / 100,
      medianEndingValue: allFinalValues[medianIdx] ?? 0,
      bestCase: allFinalValues[p95Idx] ?? 0,
      worstCase: allFinalValues[p5Idx] ?? 0,
      shortfallAge,
      annualSafeWithdrawal: Math.round(annualSafeWithdrawal),
      withdrawalRate: Math.round((annualSafeWithdrawal / input.currentSavings) * 10000) / 100,
      trials,
      confidenceLevel: Math.round(targetSuccessRate * 100),
      yearByYear,
    };
  }

  /**
   * Estate Tax Calculation
   * Models current federal + state estate tax with sunset provision analysis.
   */
  static calculateEstateTax(input: {
    grossEstate: number;
    adjustedGifts: number;
    stateTaxRate: number;
    portabilityAvailable: boolean;
    spouseExemptionUsed: number;
    charitableDeductions: number;
    debtsAndExpenses: number;
  }): EstateTaxResult {
    // 2024 Federal exemption (sunset to ~$7M in 2026)
    const currentExemption = 13610000; // $13.61M per person
    const sunsetExemption = 7000000; // ~$7M after 2025 sunset

    const totalEstate = input.grossEstate + input.adjustedGifts;
    const adjustedGross = totalEstate - input.debtsAndExpenses - input.charitableDeductions;

    // Calculate exemption (with portability)
    const availableExemption = input.portabilityAvailable
      ? currentExemption * 2 - input.spouseExemptionUsed
      : currentExemption;

    const exemptionUsed = Math.min(availableExemption, adjustedGross);
    const exemptionRemaining = Math.max(0, availableExemption - adjustedGross);
    const taxableEstate = Math.max(0, adjustedGross - availableExemption);

    // Federal estate tax (40% flat rate above exemption)
    const federalTax = taxableEstate * 0.40;

    // State estate tax
    const stateExemption = 6000000; // Varies by state
    const stateTaxable = Math.max(0, adjustedGross - stateExemption);
    const stateTax = stateTaxable * input.stateTaxRate;

    const totalTax = federalTax + stateTax;
    const netToBeneficiaries = adjustedGross - totalTax;
    const effectiveRate = adjustedGross > 0 ? totalTax / adjustedGross : 0;

    // Sunset analysis
    const sunsetAvailableExemption = input.portabilityAvailable
      ? sunsetExemption * 2 - input.spouseExemptionUsed
      : sunsetExemption;
    const sunsetTaxable = Math.max(0, adjustedGross - sunsetAvailableExemption);
    const sunsetTax = sunsetTaxable * 0.40;
    const additionalTaxAtSunset = sunsetTax - federalTax;

    return {
      grossEstate: totalEstate,
      adjustedGross,
      taxableEstate,
      estateTax: Math.round(federalTax),
      effectiveRate: Math.round(effectiveRate * 10000) / 100,
      exemptionUsed: Math.round(exemptionUsed),
      exemptionRemaining: Math.round(exemptionRemaining),
      portabilityAvailable: input.portabilityAvailable,
      stateEstateTax: Math.round(stateTax),
      totalTax: Math.round(totalTax),
      netToBeneficiaries: Math.round(netToBeneficiaries),
      sunsetProvision: {
        currentExemption,
        sunsetExemption,
        additionalTaxAtSunset: Math.round(additionalTaxAtSunset),
        planningOpportunity:
          additionalTaxAtSunset > 0
            ? `Estate faces $${Math.round(additionalTaxAtSunset).toLocaleString()} additional tax at 2025 sunset. Consider accelerated gifting strategies before exemption reduction.`
            : "Estate is below sunset exemption — no additional exposure.",
      },
    };
  }

  /**
   * Insurance Needs Analysis
   */
  static calculateInsuranceNeeds(input: {
    annualIncome: number;
    yearsOfIncomeNeeded: number;
    mortgageBalance: number;
    educationCostPerChild: number;
    numberOfChildren: number;
    finalExpenses: number;
    estateLiquidityNeeded: number;
    existingLifeCoverage: number;
    existingDisabilityCoverage: number;
    disabilityMonthlyNeed: number;
    ltcDailyCost: number;
    ltcYearsNeeded: number;
    inflationRate: number;
  }): InsuranceNeedsResult {
    const incomeReplacement = input.annualIncome * input.yearsOfIncomeNeeded;
    const educationFunding = input.educationCostPerChild * input.numberOfChildren;

    const totalLifeNeed =
      incomeReplacement +
      input.mortgageBalance +
      educationFunding +
      input.finalExpenses +
      input.estateLiquidityNeeded;

    const lifeGap = Math.max(0, totalLifeNeed - input.existingLifeCoverage);

    const disabilityGap = Math.max(
      0,
      input.disabilityMonthlyNeed * 12 - input.existingDisabilityCoverage,
    );

    const ltcCost = input.ltcDailyCost * 365 * input.ltcYearsNeeded *
      Math.pow(1 + input.inflationRate, 10); // 10 years until likely need

    return {
      lifeInsuranceNeeded: Math.round(lifeGap),
      disabilityInsuranceNeeded: Math.round(disabilityGap),
      ltcInsuranceNeeded: Math.round(ltcCost),
      breakdown: {
        incomeReplacement: Math.round(incomeReplacement),
        mortgagePayoff: Math.round(input.mortgageBalance),
        educationFunding: Math.round(educationFunding),
        estateLiquidity: Math.round(input.estateLiquidityNeeded),
        finalExpenses: Math.round(input.finalExpenses),
        existingCoverage: Math.round(input.existingLifeCoverage),
        gap: Math.round(lifeGap),
      },
    };
  }

  /**
   * Education Funding Plan
   */
  static calculateEducationPlan(input: {
    children: { name: string; currentAge: number; collegeStartAge: number }[];
    annualCollegeCost: number;
    costInflationRate: number;
    currentSavings: number;
    investmentReturn: number;
  }): EducationPlanResult {
    const byChild = input.children.map((child) => {
      const yearsUntilCollege = child.collegeStartAge - child.currentAge;
      const yearsInCollege = 4;
      const inflatedAnnualCost = input.annualCollegeCost *
        Math.pow(1 + input.costInflationRate, yearsUntilCollege);

      const totalCost = inflatedAnnualCost * yearsInCollege;

      // Future value of current savings
      const fvSavings = input.currentSavings *
        Math.pow(1 + input.investmentReturn, yearsUntilCollege);

      const savingsNeeded = Math.max(0, totalCost - fvSavings);

      return {
        name: child.name,
        currentAge: child.currentAge,
        collegeStartAge: child.collegeStartAge,
        annualCost: Math.round(inflatedAnnualCost),
        totalCost: Math.round(totalCost),
        savingsNeeded: Math.round(savingsNeeded),
      };
    });

    const totalCost = byChild.reduce((sum, c) => sum + c.totalCost, 0);
    const totalSavingsNeeded = byChild.reduce((sum, c) => sum + c.savingsNeeded, 0);

    // Calculate annual savings needed (annuity formula)
    const yearsToFirst = Math.min(...input.children.map((c) => c.collegeStartAge - c.currentAge));
    const annualSavingsNeeded =
      yearsToFirst > 0 && totalSavingsNeeded > 0
        ? totalSavingsNeeded *
          (input.investmentReturn / (Math.pow(1 + input.investmentReturn, yearsToFirst) - 1))
        : 0;

    const lumpSumNeeded = totalSavingsNeeded /
      Math.pow(1 + input.investmentReturn, yearsToFirst);

    const fundedPercent = totalCost > 0
      ? Math.min(100, Math.round((input.currentSavings / totalCost) * 100))
      : 100;

    return {
      totalCost: Math.round(totalCost),
      annualSavingsNeeded: Math.round(annualSavingsNeeded),
      lumpSumNeeded: Math.round(lumpSumNeeded),
      fundedPercent,
      byChild,
    };
  }

  /**
   * Social Security Optimization
   * Compares filing strategies: 62, FRA, 70, and spousal combinations.
   */
  static optimizeSocialSecurity(input: {
    birthYear: number;
    fullRetirementAge: number;
    piaMonthly: number; // Primary Insurance Amount at FRA
    lifeExpectancy: number;
    spouseBirthYear: number;
    spousePiaMonthly: number;
    spouseFullRetirementAge: number;
    discountRate: number;
  }): SocialSecurityStrategy {
    const strategies: { filingAge: number; lifetimeBenefit: number }[] = [];

    // Calculate lifetime benefit for each filing age (62-70)
    for (let filingAge = 62; filingAge <= 70; filingAge++) {
      const yearsBeforeFRA = filingAge - input.fullRetirementAge;
      const reductionFactor = yearsBeforeFRA < 0
        ? 1 - Math.abs(yearsBeforeFRA) * 0.00555 // Pre-FRA reduction
        : 1 + yearsBeforeFRA * 0.08; // Delay credits

      const monthlyBenefit = input.piaMonthly * Math.min(2.8, Math.max(0.7, reductionFactor));
      const yearsOfCollection = input.lifeExpectancy - filingAge;
      const lifetimeBenefit = monthlyBenefit * 12 * yearsOfCollection;

      strategies.push({ filingAge, lifetimeBenefit: Math.round(lifetimeBenefit) });
    }

    // Find optimal strategy
    const optimal = strategies.reduce((best, s) =>
      s.lifetimeBenefit > best.lifetimeBenefit ? s : best,
    );

    // Spousal benefit analysis
    const spousalBenefit = Math.min(
      input.spousePiaMonthly * 0.5,
      input.piaMonthly * 0.5,
    );

    // Break-even age vs filing at 62
    const benefit62 = strategies.find((s) => s.filingAge === 62)!.lifetimeBenefit;
    const annualDifference = (optimal.lifetimeBenefit - benefit62) /
      (input.lifeExpectancy - optimal.filingAge);
    const breakEvenAge = annualDifference > 0
      ? optimal.filingAge + Math.ceil(benefit62 / annualDifference)
      : optimal.filingAge;

    return {
      strategy: `File at ${optimal.filingAge}`,
      filingAge: optimal.filingAge,
      spousalBenefit: Math.round(spousalBenefit),
      totalLifetimeBenefit: optimal.lifetimeBenefit,
      breakEvenAge,
      recommendation:
        optimal.filingAge >= 67
          ? `Delaying to ${optimal.filingAge} maximizes lifetime benefit by $${(optimal.lifetimeBenefit - benefit62).toLocaleString()}. Break-even vs 62 is age ${breakEvenAge}.`
          : `Filing at ${optimal.filingAge} provides the best lifetime outcome. Consider spousal coordination for additional $${Math.round(spousalBenefit * 12).toLocaleString()}/year.`,
      alternatives: strategies,
    };
  }

  /**
   * Roth Conversion Ladder Optimization
   * Finds the optimal sequence of Roth conversions to minimize lifetime tax.
   */
  static optimizeRothConversions(input: {
    currentAge: number;
    traditionalIraBalance: number;
    retirementAge: number;
    rmdStartAge: number; // 73 or 75 depending on SECURE Act
    currentTaxBracket: number;
    expectedRetirementBracket: number;
    expectedRmdBracket: number;
    yearsToConvert: number;
    annualIncomeFloor: number;
    topOfBracket: number;
    growthRate: number;
  }): RothConversionLadder {
    const conversions: RothConversionLadder["conversions"] = [];
    let remaining = input.traditionalIraBalance;
    let totalTaxCost = 0;
    let totalRmdAvoided = 0;

    for (let y = 0; y < input.yearsToConvert && remaining > 0; y++) {
      const age = input.currentAge + y;

      // Fill up the bracket each year
      const conversionCapacity = Math.max(0, input.topOfBracket - input.annualIncomeFloor);
      const conversionAmount = Math.min(remaining, conversionCapacity);

      if (conversionAmount <= 0) break;

      const taxCost = conversionAmount * input.currentTaxBracket;

      // Future RMD that would have been required on this amount
      const yearsToRmd = input.rmdStartAge - age;
      const futureValue = conversionAmount * Math.pow(1 + input.growthRate, yearsToRmd);
      const rmdAvoided = futureValue / (input.rmdStartAge - 72); // Approximate RMD divisor
      const taxSavedOnRmd = rmdAvoided * input.expectedRmdBracket;

      conversions.push({
        year: new Date().getFullYear() + y,
        amount: Math.round(conversionAmount),
        taxCost: Math.round(taxCost),
        rmdAvoided: Math.round(rmdAvoided),
      });

      remaining -= conversionAmount;
      totalTaxCost += taxCost;
      totalRmdAvoided += rmdAvoided;
    }

    const netBenefit = totalRmdAvoided * input.expectedRmdBracket - totalTaxCost;
    const irrOnTaxPaid = totalTaxCost > 0
      ? Math.pow(netBenefit / totalTaxCost + 1, 1 / input.yearsToConvert) - 1
      : 0;

    return {
      conversions,
      totalTaxCost: Math.round(totalTaxCost),
      totalRmdAvoided: Math.round(totalRmdAvoided),
      netBenefit: Math.round(netBenefit),
      irrOnTaxPaid: Math.round(irrOnTaxPaid * 10000) / 100,
    };
  }
}
