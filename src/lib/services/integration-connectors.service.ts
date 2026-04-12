import "server-only";

import prisma from "@/lib/db";
import { AuditEventService } from "./audit-event.service";

/**
 * Integration Connectors Service
 *
 * Provides typed connector interfaces for all major financial integrations.
 * Each connector follows the same pattern:
 * 1. Read config from IntegrationConfig table
 * 2. Authenticate with the provider
 * 3. Fetch/sync data
 * 4. Normalize into Drift AI data model
 * 5. Record audit event
 *
 * Connectors are stubs — implement the provider-specific API calls
 * when you have API keys/credentials for each provider.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProviderCategory =
  | "CUSTODIAN"
  | "PORTFOLIO_ACCOUNTING"
  | "CRM"
  | "CALENDAR"
  | "EMAIL_DELIVERY"
  | "E_SIGNATURE"
  | "MARKET_DATA";

interface SyncResult {
  synced: number;
  errors: number;
  details: string;
}

interface CustodianPosition {
  symbol: string;
  name: string;
  quantity: number;
  marketValue: number;
  costBasis?: number;
  assetClass: string;
  accountNumber: string;
}

interface CRMContact {
  name: string;
  email?: string;
  phone?: string;
  type?: string;
  tags?: string[];
  customFields?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Base Connector
// ---------------------------------------------------------------------------

abstract class BaseConnector {
  protected organizationId: string;
  protected provider: string;
  protected category: ProviderCategory;

  constructor(organizationId: string, provider: string, category: ProviderCategory) {
    this.organizationId = organizationId;
    this.provider = provider;
    this.category = category;
  }

  protected async getConfig(): Promise<Record<string, unknown> | null> {
    const config = await prisma.integrationConfig.findUnique({
      where: {
        organizationId_provider: {
          organizationId: this.organizationId,
          provider: this.provider,
        },
      },
      select: { config: true, status: true },
    });

    if (!config || config.status !== "ACTIVE") return null;
    return config.config as Record<string, unknown>;
  }

  protected async recordSync(result: SyncResult): Promise<void> {
    await prisma.integrationConfig.update({
      where: {
        organizationId_provider: {
          organizationId: this.organizationId,
          provider: this.provider,
        },
      },
      data: {
        lastSyncAt: new Date(),
        errorCount: result.errors,
        lastError: result.errors > 0 ? result.details : null,
      },
    });

    await AuditEventService.appendEvent({
      organizationId: this.organizationId,
      action: "INTEGRATION_SYNC",
      target: `Integration:${this.provider}`,
      details: `${this.provider} sync: ${result.synced} synced, ${result.errors} errors. ${result.details}`,
      severity: result.errors > 0 ? "WARNING" : "INFO",
      metadata: { provider: this.provider, category: this.category, result },
    });
  }
}

// ---------------------------------------------------------------------------
// Custodian Connectors
// ---------------------------------------------------------------------------

export class SchwabConnector extends BaseConnector {
  constructor(organizationId: string) {
    super(organizationId, "SCHWAB", "CUSTODIAN");
  }

  /**
   * Sync positions from Schwab Advisor Center API.
   * Requires: SCHWAB_CLIENT_ID, SCHWAB_CLIENT_SECRET in IntegrationConfig
   */
  async syncPositions(): Promise<SyncResult> {
    const config = await this.getConfig();
    if (!config) return { synced: 0, errors: 1, details: "Schwab integration not configured" };

    // TODO: Implement Schwab Advisor Center API calls
    // 1. Authenticate with OAuth2 using config.clientId + config.clientSecret
    // 2. GET /accounts/{accountNumber}/positions
    // 3. Normalize into CustodianPosition[]
    // 4. Upsert into FinancialAccount + Holding tables

    await this.recordSync({ synced: 0, errors: 0, details: "Schwab connector ready — implement API calls" });
    return { synced: 0, errors: 0, details: "Stub — implement with Schwab API credentials" };
  }
}

export class FidelityConnector extends BaseConnector {
  constructor(organizationId: string) {
    super(organizationId, "FIDELITY", "CUSTODIAN");
  }

  async syncPositions(): Promise<SyncResult> {
    const config = await this.getConfig();
    if (!config) return { synced: 0, errors: 1, details: "Fidelity integration not configured" };

    // TODO: Implement Fidelity Wealthscape API calls
    await this.recordSync({ synced: 0, errors: 0, details: "Fidelity connector ready — implement API calls" });
    return { synced: 0, errors: 0, details: "Stub — implement with Fidelity API credentials" };
  }
}

// ---------------------------------------------------------------------------
// Portfolio Accounting Connectors
// ---------------------------------------------------------------------------

export class BlackDiamondConnector extends BaseConnector {
  constructor(organizationId: string) {
    super(organizationId, "BLACK_DIAMOND", "PORTFOLIO_ACCOUNTING");
  }

  async syncPortfolioData(): Promise<SyncResult> {
    const config = await this.getConfig();
    if (!config) return { synced: 0, errors: 1, details: "Black Diamond integration not configured" };

    // TODO: Implement Black Diamond API calls
    // 1. Authenticate with API key
    // 2. GET /portfolios with household grouping
    // 3. Normalize into FinancialAccount + Holding + Client models
    // 4. Update AUM, performance data

    await this.recordSync({ synced: 0, errors: 0, details: "Black Diamond connector ready — implement API calls" });
    return { synced: 0, errors: 0, details: "Stub — implement with Black Diamond API credentials" };
  }
}

export class AddeparConnector extends BaseConnector {
  constructor(organizationId: string) {
    super(organizationId, "ADDEPAR", "PORTFOLIO_ACCOUNTING");
  }

  async syncPortfolioData(): Promise<SyncResult> {
    const config = await this.getConfig();
    if (!config) return { synced: 0, errors: 1, details: "Addepar integration not configured" };

    // TODO: Implement Addepar API calls
    await this.recordSync({ synced: 0, errors: 0, details: "Addepar connector ready — implement API calls" });
    return { synced: 0, errors: 0, details: "Stub — implement with Addepar API credentials" };
  }
}

// ---------------------------------------------------------------------------
// CRM Migration Connectors
// ---------------------------------------------------------------------------

export class RedtailConnector extends BaseConnector {
  constructor(organizationId: string) {
    super(organizationId, "REDTAIL", "CRM");
  }

  /**
   * Import contacts from Redtail CRM.
   * One-time migration — not a recurring sync.
   */
  async importContacts(): Promise<SyncResult> {
    const config = await this.getConfig();
    if (!config) return { synced: 0, errors: 1, details: "Redtail integration not configured" };

    // TODO: Implement Redtail API calls
    // 1. Authenticate with API key + user key
    // 2. GET /contacts with pagination
    // 3. Normalize into CRMContact[]
    // 4. Upsert into Client + IntelligenceProfile + ClientTag

    await this.recordSync({ synced: 0, errors: 0, details: "Redtail connector ready — implement API calls" });
    return { synced: 0, errors: 0, details: "Stub — implement with Redtail API credentials" };
  }
}

export class WealthboxConnector extends BaseConnector {
  constructor(organizationId: string) {
    super(organizationId, "WEALTHBOX", "CRM");
  }

  async importContacts(): Promise<SyncResult> {
    const config = await this.getConfig();
    if (!config) return { synced: 0, errors: 1, details: "Wealthbox integration not configured" };

    // TODO: Implement Wealthbox API calls
    await this.recordSync({ synced: 0, errors: 0, details: "Wealthbox connector ready — implement API calls" });
    return { synced: 0, errors: 0, details: "Stub — implement with Wealthbox API credentials" };
  }
}

export class SalesforceFSCConnector extends BaseConnector {
  constructor(organizationId: string) {
    super(organizationId, "SALESFORCE_FSC", "CRM");
  }

  async importContacts(): Promise<SyncResult> {
    const config = await this.getConfig();
    if (!config) return { synced: 0, errors: 1, details: "Salesforce FSC integration not configured" };

    // TODO: Implement Salesforce Financial Services Cloud API calls
    // 1. OAuth2 authenticate
    // 2. SOQL query on Account + FinancialAccount objects
    // 3. Normalize and upsert

    await this.recordSync({ synced: 0, errors: 0, details: "Salesforce FSC connector ready — implement API calls" });
    return { synced: 0, errors: 0, details: "Stub — implement with Salesforce credentials" };
  }
}

// ---------------------------------------------------------------------------
// Calendar Connectors
// ---------------------------------------------------------------------------

export class GoogleCalendarConnector extends BaseConnector {
  constructor(organizationId: string) {
    super(organizationId, "GOOGLE_CALENDAR", "CALENDAR");
  }

  async syncEvents(): Promise<SyncResult> {
    const config = await this.getConfig();
    if (!config) return { synced: 0, errors: 1, details: "Google Calendar integration not configured" };

    // TODO: Implement Google Calendar API calls
    // 1. OAuth2 authenticate with config.refreshToken
    // 2. GET /calendar/v3/calendars/primary/events
    // 3. Match attendees to clients by email
    // 4. Upsert into Meeting table

    await this.recordSync({ synced: 0, errors: 0, details: "Google Calendar connector ready — implement API calls" });
    return { synced: 0, errors: 0, details: "Stub — implement with Google Calendar credentials" };
  }
}

export class OutlookCalendarConnector extends BaseConnector {
  constructor(organizationId: string) {
    super(organizationId, "OUTLOOK_CALENDAR", "CALENDAR");
  }

  async syncEvents(): Promise<SyncResult> {
    const config = await this.getConfig();
    if (!config) return { synced: 0, errors: 1, details: "Outlook Calendar integration not configured" };

    // TODO: Implement Microsoft Graph API calls
    await this.recordSync({ synced: 0, errors: 0, details: "Outlook Calendar connector ready — implement API calls" });
    return { synced: 0, errors: 0, details: "Stub — implement with Microsoft Graph credentials" };
  }
}

// ---------------------------------------------------------------------------
// Email Delivery Connectors
// ---------------------------------------------------------------------------

export class SendGridConnector extends BaseConnector {
  constructor(organizationId: string) {
    super(organizationId, "SENDGRID", "EMAIL_DELIVERY");
  }

  async sendEmail(params: { to: string; subject: string; body: string }): Promise<SyncResult> {
    const config = await this.getConfig();
    if (!config) return { synced: 0, errors: 1, details: "SendGrid integration not configured" };

    const apiKey = (config as any).apiKey as string;
    if (!apiKey) return { synced: 0, errors: 1, details: "SendGrid API key not configured" };

    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: params.to }] }],
          from: { email: (config as any).fromEmail ?? "noreply@drift-os.com" },
          subject: params.subject,
          content: [{ type: "text/html", value: params.body }],
        }),
      });

      const success = response.status === 202;
      return {
        synced: success ? 1 : 0,
        errors: success ? 0 : 1,
        details: success ? "Email sent via SendGrid" : `SendGrid error: ${response.status}`,
      };
    } catch (err) {
      return { synced: 0, errors: 1, details: `SendGrid error: ${err}` };
    }
  }
}

// ---------------------------------------------------------------------------
// Market Data Connectors
// ---------------------------------------------------------------------------

export class AlphaVantageConnector extends BaseConnector {
  constructor(organizationId: string) {
    super(organizationId, "ALPHA_VANTAGE", "MARKET_DATA");
  }

  async getQuote(symbol: string): Promise<{ price: number; change: number } | null> {
    const config = await this.getConfig();
    if (!config) return null;

    const apiKey = (config as any).apiKey as string;
    if (!apiKey) return null;

    try {
      const response = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`,
      );
      const data = await response.json();
      const quote = data["Global Quote"];
      if (!quote) return null;

      return {
        price: parseFloat(quote["05. price"]),
        change: parseFloat(quote["10. change percent"]?.replace("%", "")),
      };
    } catch {
      return null;
    }
  }
}

export class PolygonIOConnector extends BaseConnector {
  constructor(organizationId: string) {
    super(organizationId, "POLYGON_IO", "MARKET_DATA");
  }

  async getQuote(symbol: string): Promise<{ price: number; change: number } | null> {
    const config = await this.getConfig();
    if (!config) return null;

    const apiKey = (config as any).apiKey as string;
    if (!apiKey) return null;

    try {
      const response = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?apiKey=${apiKey}`,
      );
      const data = await response.json();
      if (!data.results?.[0]) return null;

      const result = data.results[0];
      return {
        price: result.c, // close price
        change: ((result.c - result.o) / result.o) * 100,
      };
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Connector Factory
// ---------------------------------------------------------------------------

export function getConnector(
  organizationId: string,
  provider: string,
): BaseConnector | null {
  switch (provider) {
    case "SCHWAB": return new SchwabConnector(organizationId);
    case "FIDELITY": return new FidelityConnector(organizationId);
    case "BLACK_DIAMOND": return new BlackDiamondConnector(organizationId);
    case "ADDEPAR": return new AddeparConnector(organizationId);
    case "REDTAIL": return new RedtailConnector(organizationId);
    case "WEALTHBOX": return new WealthboxConnector(organizationId);
    case "SALESFORCE_FSC": return new SalesforceFSCConnector(organizationId);
    case "GOOGLE_CALENDAR": return new GoogleCalendarConnector(organizationId);
    case "OUTLOOK_CALENDAR": return new OutlookCalendarConnector(organizationId);
    case "SENDGRID": return new SendGridConnector(organizationId);
    case "ALPHA_VANTAGE": return new AlphaVantageConnector(organizationId);
    case "POLYGON_IO": return new PolygonIOConnector(organizationId);
    default: return null;
  }
}
