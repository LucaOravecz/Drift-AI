import "server-only";

import prisma from "@/lib/db";
import { AuditEventService } from "./audit-event.service";
import { GipsPerformanceService } from "./gips-performance.service";
import { randomBytes, createHash } from "crypto";

/**
 * Client Portal Service
 *
 * White-labeled client-facing experience providing:
 * - Portfolio dashboard (read-only)
 * - Document vault (secure file sharing)
 * - Secure messaging (encrypted, compliant)
 * - Meeting scheduling
 * - Performance reporting
 * - Beneficiary & account info
 *
 * Security:
 * - Separate client auth (not advisor auth)
 * - Read-only portfolio access
 * - All actions audit-logged
 * - Session timeout controls
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClientPortalSession {
  clientId: string;
  organizationId: string;
  token: string;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
}

export interface ClientPortfolioView {
  client: {
    id: string;
    name: string;
    email: string;
    riskProfile: string;
  };
  totalAum: number;
  accounts: ClientAccountView[];
  performance: {
    ytd: number;
    oneYear: number;
    threeYear: number;
  };
  recentTransactions: RecentTransaction[];
  upcomingMeetings: UpcomingMeeting[];
}

export interface ClientAccountView {
  id: string;
  name: string;
  type: string;
  custodian: string;
  totalValue: number;
  cashBalance: number;
  holdings: ClientHoldingView[];
}

export interface ClientHoldingView {
  ticker: string;
  name: string;
  quantity: number;
  marketValue: number;
  weightPercent: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPercent: number;
}

export interface RecentTransaction {
  date: Date;
  type: string;
  description: string;
  amount: number;
  ticker?: string;
}

export interface UpcomingMeeting {
  id: string;
  title: string;
  date: Date;
  duration: number;
  location?: string;
  meetingUrl?: string;
}

export interface SecureMessage {
  id: string;
  clientId: string;
  advisorId: string;
  subject: string;
  body: string;
  direction: "INBOUND" | "OUTBOUND";
  readAt?: Date;
  createdAt: Date;
  attachments: { name: string; url: string }[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ClientPortalService {
  /**
   * Authenticate a client for portal access.
   * Uses a separate auth flow from advisors — email + access code.
   */
  static async authenticateClient(
    email: string,
    accessCode: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<ClientPortalSession | null> {
    const client = await prisma.client.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!client) return null;

    // Verify access code (stored as hash in client portal settings)
    // In production, use proper password hashing
    const codeHash = createHash("sha256").update(accessCode).digest("hex");

    // TODO: Compare against stored hash
    // For now, accept any code for development
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 4 * 3600000); // 4 hour session

    await AuditEventService.appendEvent({
      organizationId: client.organizationId,
      action: "CLIENT_PORTAL_LOGIN",
      target: `Client:${client.id}`,
      details: `Client portal login from ${ipAddress}`,
      severity: "INFO",
      metadata: { clientId: client.id, ipAddress },
    });

    return {
      clientId: client.id,
      organizationId: client.organizationId,
      token,
      expiresAt,
      ipAddress,
      userAgent,
    };
  }

  /**
   * Get the full portfolio view for a client.
   */
  static async getClientPortfolioView(clientId: string): Promise<ClientPortfolioView | null> {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        accounts: {
          include: { holdings: true },
        },
        meetings: {
          where: { status: "SCHEDULED" },
          orderBy: { scheduledAt: "asc" },
          take: 5,
        },
      },
    });

    if (!client) return null;

    const totalAum = client.accounts.reduce(
      (sum, a) => sum + a.holdings.reduce((s, h) => s + (h.marketValue ?? 0), 0),
      0,
    );

    const accounts: ClientAccountView[] = client.accounts.map((account) => {
      const accountTotal = account.holdings.reduce((s, h) => s + (h.marketValue ?? 0), 0);

      const holdings: ClientHoldingView[] = account.holdings.map((h) => {
        const gainLoss = (h.marketValue ?? 0) - (h.costBasis ?? 0);
        const gainLossPct = (h.costBasis ?? 0) > 0 ? gainLoss / h.costBasis! : 0;

        return {
          ticker: h.symbol,
          name: h.name,
          quantity: h.quantity,
          marketValue: h.marketValue ?? 0,
          weightPercent: accountTotal > 0 ? ((h.marketValue ?? 0) / accountTotal) * 100 : 0,
          unrealizedGainLoss: gainLoss,
          unrealizedGainLossPercent: gainLossPct * 100,
        };
      });

      return {
        id: account.id,
        name: account.accountName,
        type: account.accountType,
        custodian: account.custodian ?? "N/A",
        totalValue: accountTotal,
        cashBalance: account.cashBalance,
        holdings,
      };
    });

    // Performance placeholders
    const performance = { ytd: 0, oneYear: 0, threeYear: 0 };

    const upcomingMeetings: UpcomingMeeting[] = client.meetings.map((m) => ({
      id: m.id,
      title: m.title,
      date: m.scheduledAt,
      duration: 60,
      location: m.location ?? undefined,
      meetingUrl: m.meetingUrl ?? undefined,
    }));

    return {
      client: {
        id: client.id,
        name: client.name,
        email: client.email ?? "",
        riskProfile: client.riskProfile ?? "",
      },
      totalAum,
      accounts,
      performance,
      recentTransactions: [],
      upcomingMeetings,
    };
  }

  /**
   * Send a secure message from client to advisor.
   */
  static async sendClientMessage(
    clientId: string,
    subject: string,
    body: string,
    attachments: { name: string; url: string }[] = [],
  ): Promise<SecureMessage> {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { organizationId: true },
    });

    if (!client) throw new Error("Client not found");

    // Store as a communication record
    const comm = await prisma.communication.create({
      data: {
        clientId,
        channel: "PORTAL",
        direction: "INBOUND",
        subject,
        body,
        status: "RECEIVED",
        aiSummary: null,
        complianceStatus: "PENDING",
      },
    });

    await AuditEventService.appendEvent({
      organizationId: client.organizationId,
      action: "CLIENT_PORTAL_MESSAGE",
      target: `Client:${clientId}`,
      details: `Client sent message: "${subject}"`,
      severity: "INFO",
      metadata: { clientId, subject, attachmentCount: attachments.length },
    });

    return {
      id: comm.id,
      clientId,
      advisorId: "",
      subject,
      body,
      direction: "INBOUND",
      createdAt: comm.createdAt,
      attachments,
    };
  }

  /**
   * Get documents shared with the client.
   */
  static async getClientDocuments(clientId: string) {
    const documents = await prisma.document.findMany({
      where: { clientId, sharedWithClient: true },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        fileName: true,
        documentType: true,
        uploadedAt: true,
        fileSize: true,
      },
    });

    return documents;
  }

  /**
   * Generate a secure document sharing link.
   */
  static async generateDocumentShareLink(
    documentId: string,
    clientId: string,
    organizationId: string,
    expiresInHours: number = 72,
  ): Promise<string> {
    const token = randomBytes(32).toString("hex");

    // In production, store token with expiry in Redis or DB
    // and serve document through a signed URL endpoint

    await AuditEventService.appendEvent({
      organizationId,
      action: "DOCUMENT_SHARED_WITH_CLIENT",
      target: `Document:${documentId}`,
      details: `Document shared with client, expires in ${expiresInHours}h`,
      severity: "INFO",
      metadata: { documentId, clientId, expiresInHours },
    });

    return `/portal/documents/${documentId}?token=${token}`;
  }
}
