export interface ClientPortalExperience {
  client: {
    id: string;
    householdId: string | null;
    name: string;
    email: string;
    advisorName: string;
    organizationName: string;
    portalLabel: string;
    riskProfile: string;
    lifeStage: string;
    tagline: string;
    lastUpdatedAt: string;
  };
  overview: {
    totalNetWorth: number;
    investableAssets: number;
    cashReserve: number;
    annualIncomeTarget: number;
    fundedStatusPercent: number;
    monthlyIncomeAtTargetRetirement: number;
    nextMilestoneLabel: string;
    nextMilestoneDate: string | null;
  };
  performance: {
    ytd: number;
    oneYear: number;
    threeYearAnnualized: number;
    confidenceLabel: string;
  };
  allocation: Array<{
    label: string;
    value: number;
    percentage: number;
  }>;
  goals: Array<{
    id: string;
    title: string;
    targetLabel: string;
    fundedPercent: number;
    currentValueLabel: string;
    gapLabel: string;
    detail: string;
  }>;
  scenarios: Array<{
    id: string;
    label: string;
    retirementAge: number;
    successRate: number;
    fundedPercent: number;
    monthlyIncome: number;
    medianEndingValue: number;
    narrative: string;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    custodian: string;
    totalValue: number;
    cashBalance: number;
    targetMix: Array<{
      label: string;
      percentage: number;
    }>;
    topHoldings: Array<{
      ticker: string;
      name: string;
      assetClass: string;
      marketValue: number;
      weightPercent: number;
      gainLoss: number;
    }>;
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    category: string;
    status: string;
    uploadedAt: string;
    fileSizeBytes: number;
    summary: string;
    actionItems: string[];
    riskItems: string[];
    requiresSignature: boolean;
  }>;
  openItems: Array<{
    id: string;
    title: string;
    type: "SIGNATURE" | "UPLOAD" | "REVIEW" | "MEETING" | "ACTION";
    status: string;
    dueLabel: string;
    detail: string;
  }>;
  family: {
    householdName: string;
    totalHouseholdValue: number;
    members: Array<{
      id: string;
      name: string;
      entityType: string;
      roleLabel: string;
      netWorth: number;
      documentCount: number;
      accountCount: number;
      lastTouchLabel: string;
    }>;
  };
  timeline: Array<{
    id: string;
    title: string;
    kind: "MEETING" | "LIFE_EVENT" | "DOCUMENT" | "REQUEST";
    date: string;
    detail: string;
  }>;
  communications: Array<{
    id: string;
    direction: "INBOUND" | "OUTBOUND";
    subject: string;
    preview: string;
    timestamp: string;
    status: string;
  }>;
  insights: {
    headline: string;
    summary: string;
    strengths: string[];
    watchItems: string[];
  };
}
