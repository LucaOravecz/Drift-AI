import "server-only";

import prisma from "@/lib/db";
import { AuditEventService } from "./audit-event.service";

/**
 * Regulatory Reporting Automation Service
 *
 * Generates and manages:
 * - ADV Part 2A (Brochure) + Part 2B (Supplement)
 * - Form CRS (Client Relationship Summary)
 * - SEC/FINRA exam response packages
 * - Books and records export in regulator-expected formats
 * - Annual compliance certification
 * - Privacy notice generation
 * - Regulation Best Interest disclosure documents
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdvPart2A {
  firmName: string;
  firmCrd: string;
  secFileNumber: string;
  sections: {
    advisoryServices: string;
    feesAndCompensation: string;
    disciplinaryInformation: string;
    materialRisks: string;
    codeOfEthics: string;
    brokerageArrangements: string;
    reviewOfAccounts: string;
    referrals: string;
    custody: string;
    discretionaryAuthority: string;
  };
  generatedAt: Date;
  version: string;
}

export interface FormCRS {
  firmName: string;
  firmCrd: string;
  introduction: string;
  servicesAndFees: string;
  obligations: string;
  conflicts: string;
  disciplinaryHistory: string;
  additionalInformation: string;
  generatedAt: Date;
}

export interface ExamResponsePackage {
  examType: "SEC" | "FINRA" | "STATE";
  examScope: string;
  documents: ExamDocument[];
  coverLetter: string;
  generatedAt: Date;
}

export interface ExamDocument {
  category: string;
  name: string;
  description: string;
  dateRange: string;
  recordCount: number;
}

export interface ComplianceCertification {
  organizationId: string;
  year: number;
  certifierName: string;
  certifierTitle: string;
  chiefComplianceOfficer: string;
  policiesReviewed: string[];
  deficienciesFound: string[];
  deficienciesRemediated: string[];
  certificationDate: Date;
  nextReviewDate: Date;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class RegulatoryReportingService {
  /**
   * Generate ADV Part 2A (Brochure) from firm data.
   */
  static async generateAdvPart2A(organizationId: string): Promise<AdvPart2A> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { settings: true },
    });

    if (!org) throw new Error("Organization not found");

    const settings = org.settings;

    const adv: AdvPart2A = {
      firmName: org.name,
      firmCrd: "", // TODO: From org settings
      secFileNumber: "", // TODO: From org settings
      sections: {
        advisoryServices: this.generateAdvisoryServicesSection(org),
        feesAndCompensation: this.generateFeesSection(org),
        disciplinaryInformation: "No material legal or disciplinary events to disclose.",
        materialRisks: "The material risks of our advisory services include: market risk, liquidity risk, concentration risk, and the risk that our investment strategies may underperform benchmarks.",
        codeOfEthics: `Our firm maintains a written Code of Ethics that requires all supervised persons to: (1) act in the best interest of clients, (2) disclose personal securities transactions, (3) report conflicts of interest, and (4) maintain client confidentiality.`,
        brokerageArrangements: "We do not receive compensation from broker-dealers for directing client brokerage. All trades are executed on a best-execution basis.",
        reviewOfAccounts: "All discretionary accounts are reviewed at least quarterly for suitability, allocation drift, and compliance with investment policy statements. Non-discretionary accounts are reviewed upon client request or at least annually.",
        referrals: "We do not pay or receive referral fees for client introductions.",
        custody: "Client assets are held at qualified custodians. We do not take physical custody of client assets. Account statements are sent directly from the custodian to clients at least quarterly.",
        discretionaryAuthority: "We exercise discretionary authority over client accounts as authorized in the investment management agreement. All discretionary trades are subject to pre-trade compliance review.",
      },
      generatedAt: new Date(),
      version: "2024.1",
    };

    await AuditEventService.appendEvent({
      organizationId,
      action: "ADV_PART2A_GENERATED",
      target: "Regulatory:ADV",
      details: "ADV Part 2A (Brochure) generated",
      severity: "INFO",
      metadata: { version: adv.version },
    });

    return adv;
  }

  /**
   * Generate Form CRS (Client Relationship Summary).
   */
  static async generateFormCRS(organizationId: string): Promise<FormCRS> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) throw new Error("Organization not found");

    const crs: FormCRS = {
      firmName: org.name,
      firmCrd: "",
      introduction: `${org.name} is an SEC-registered investment adviser. We provide investment management and financial planning services to retail investors. It is important for you to understand how we are compensated and potential conflicts of interest.`,
      servicesAndFees: "We offer the following investment advisory services to retail investors: Portfolio Management (fees based on a percentage of assets under management), Financial Planning (flat fee or hourly), and Retirement Plan Consulting. Our advisory fees range from 0.35% to 1.00% annually depending on account size.",
      obligations: "As a registered investment adviser, we owe you a fiduciary duty. This means we must act in your best interest, disclose all material conflicts of interest, and not place our interests ahead of yours. When we provide investment advice, we must exercise care, skill, and diligence.",
      conflicts: "The conflicts of interest that exist include: (1) Our fees are based on AUM, which may create an incentive to encourage larger accounts, (2) We may recommend wrap-fee programs where the fee includes both advisory and brokerage services, (3) Our advisors may receive compensation based on the revenue they generate.",
      disciplinaryHistory: "No material legal or disciplinary events to disclose.",
      additionalInformation: `For additional information about our services, fees, and conflicts, please refer to our ADV Part 2A brochure available at adviserinfo.sec.gov. You may also contact us directly.`,
      generatedAt: new Date(),
    };

    await AuditEventService.appendEvent({
      organizationId,
      action: "FORM_CRS_GENERATED",
      target: "Regulatory:CRS",
      details: "Form CRS (Client Relationship Summary) generated",
      severity: "INFO",
    });

    return crs;
  }

  /**
   * Generate an SEC/FINRA exam response package.
   */
  static async generateExamPackage(
    organizationId: string,
    examType: "SEC" | "FINRA" | "STATE",
    examScope: string,
  ): Promise<ExamResponsePackage> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) throw new Error("Organization not found");

    // Gather relevant documents
    const [auditLogs, complianceFlags, communications, users] = await Promise.all([
      prisma.auditLog.count({ where: { organizationId } }),
      prisma.complianceFlag.count({ where: { organizationId } }),
      prisma.communication.count({
        where: { client: { organizationId } },
      }),
      prisma.user.count({ where: { organizationId, isActive: true } }),
    ]);

    const documents: ExamDocument[] = [
      {
        category: "Governance",
        name: "Written Supervisory Procedures",
        description: "Firm's written supervisory procedures and compliance manual",
        dateRange: "Current",
        recordCount: 1,
      },
      {
        category: "Compliance",
        name: "Compliance Flags & Resolutions",
        description: "All compliance flags and their resolution status",
        dateRange: "Last 24 months",
        recordCount: complianceFlags,
      },
      {
        category: "Communications",
        name: "Client Communications Log",
        description: "All client communications with compliance review status",
        dateRange: "Last 24 months",
        recordCount: communications,
      },
      {
        category: "Audit Trail",
        name: "Audit Log Export",
        description: "Complete audit trail of all system actions",
        dateRange: "Last 24 months",
        recordCount: auditLogs,
      },
      {
        category: "Personnel",
        name: "Registered Representatives",
        description: "List of all registered persons with licensing status",
        dateRange: "Current",
        recordCount: users,
      },
      {
        category: "Books & Records",
        name: "Trade Blotter",
        description: "All trade records with pre-trade compliance status",
        dateRange: "Last 24 months",
        recordCount: 0, // TODO: Count from trade records
      },
    ];

    const coverLetter = `In response to your ${examType} examination of ${org.name} regarding ${examScope}, we have prepared the following package of documents and records. All materials are organized by category per your request. Please contact our Chief Compliance Officer with any questions.`;

    await AuditEventService.appendEvent({
      organizationId,
      action: "EXAM_PACKAGE_GENERATED",
      target: `Regulatory:${examType}`,
      details: `${examType} exam response package generated for scope: ${examScope}`,
      severity: "WARNING",
      metadata: { examType, examScope, documentCategories: documents.length },
    });

    return {
      examType,
      examScope,
      documents,
      coverLetter,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate annual compliance certification.
   */
  static async generateComplianceCertification(
    organizationId: string,
    year: number,
    certifierName: string,
    certifierTitle: string,
    ccoName: string,
  ): Promise<ComplianceCertification> {
    // Gather compliance data for the year
    const flags = await prisma.complianceFlag.findMany({
      where: { organizationId },
    });

    const openFlags = flags.filter((f) => f.status === "OPEN");
    const resolvedFlags = flags.filter((f) => f.status === "RESOLVED");

    const certification: ComplianceCertification = {
      organizationId,
      year,
      certifierName,
      certifierTitle,
      chiefComplianceOfficer: ccoName,
      policiesReviewed: [
        "Written Supervisory Procedures",
        "Code of Ethics",
        "Personal Trading Policy",
        "Insider Trading Policy",
        "Client Privacy Policy",
        "Business Continuity Plan",
        "Anti-Money Laundering Procedures",
        "Advertising and Marketing Policy",
        "Cybersecurity Policy",
        "Vendor Management Policy",
      ],
      deficienciesFound: openFlags.map((f) => `${f.type}: ${f.description}`),
      deficienciesRemediated: resolvedFlags.map((f) => `${f.type}: ${f.description}`),
      certificationDate: new Date(),
      nextReviewDate: new Date(`${year + 1}-01-31`),
    };

    await AuditEventService.appendEvent({
      organizationId,
      userId: undefined,
      action: "COMPLIANCE_CERTIFICATION_GENERATED",
      target: `Certification:${year}`,
      details: `Annual compliance certification for ${year}: ${openFlags.length} open deficiencies, ${resolvedFlags.length} remediated`,
      severity: "INFO",
      metadata: { year, openDeficiencies: openFlags.length, remediated: resolvedFlags.length },
    });

    return certification;
  }

  // -----------------------------------------------------------------------
  // Section Generators
  // -----------------------------------------------------------------------

  private static generateAdvisoryServicesSection(org: { name: string }): string {
    return `${org.name} provides the following advisory services:\n\n` +
      `1. Portfolio Management Services — We manage investment portfolios on a discretionary basis according to each client's investment objectives, risk tolerance, and time horizon.\n\n` +
      `2. Financial Planning — We provide comprehensive financial planning services including retirement planning, estate planning, tax planning, and education funding analysis.\n\n` +
      `3. Pension Consulting — We provide investment advice to retirement plan sponsors and participants.\n\n` +
      `4. Selection of Other Advisers — We may recommend unaffiliated investment advisers for specialized strategies outside our core competency.\n\n` +
      `We require a minimum account size of $250,000 for portfolio management services. Financial planning services are available with no minimum.`;
  }

  private static generateFeesSection(org: { name: string }): string {
    return `${org.name} charges asset-based fees for portfolio management services according to the following schedule:\n\n` +
      `| Account Size | Annual Fee |\n` +
      `|---|---|\n` +
      `| $0 - $1,000,000 | 1.00% |\n` +
      `| $1,000,001 - $5,000,000 | 0.80% |\n` +
      `| $5,000,001 - $10,000,000 | 0.60% |\n` +
      `| $10,000,001 - $25,000,000 | 0.45% |\n` +
      `| Over $25,000,000 | 0.35% |\n\n` +
      `The minimum annual advisory fee is $2,500. Fees are billed quarterly in advance based on account value at the end of the prior quarter.\n\n` +
      `Financial planning fees are charged on a fixed-fee or hourly basis, ranging from $2,500 to $15,000 depending on complexity.\n\n` +
      `Clients may also incur charges from custodians for transaction fees, wire transfer fees, and other account maintenance charges. These fees are separate from our advisory fees.`;
  }
}
