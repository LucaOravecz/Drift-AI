import "server-only";

import type { Capability } from "@/lib/services/security.service";

/**
 * Maps REST-style API resources to institutional capabilities (AND semantics).
 * Session-authenticated requests must satisfy every capability listed.
 */
const READ_MATRIX: Record<string, Capability[]> = {
  clients: ["CLIENT_VIEW"],
  workflow: ["CLIENT_VIEW"],
  portfolio: ["CLIENT_VIEW", "FINANCIAL_PII_VIEW"],
  opportunities: ["CLIENT_VIEW", "FINANCIAL_PII_VIEW"],
  tax_insights: ["CLIENT_VIEW", "FINANCIAL_PII_VIEW"],
  integrations: ["CLIENT_VIEW"],
  market_data: ["CLIENT_VIEW"],
  compliance_rules: ["CLIENT_VIEW"],
  agents: ["CLIENT_VIEW", "AI_GENERATION"],
  notifications: ["CLIENT_VIEW"],
  intelligence: ["CLIENT_VIEW", "AI_GENERATION"],
  news: ["CLIENT_VIEW"],
  scenario: ["CLIENT_VIEW", "AI_GENERATION"],
  /** View pre-built charts — no model generation on GET-only paths */
  visualizations: ["CLIENT_VIEW"],
  custodian_integrations: ["CLIENT_VIEW", "FINANCIAL_PII_VIEW"],
  /** Firm operational flags (AI kill switch, read-only mode). */
  org_settings: ["USER_MANAGE"],
  /** JSON export of a single client record (books-and-records / portability). */
  admin_export: ["USER_MANAGE"],
};

const WRITE_MATRIX: Record<string, Capability[]> = {
  clients: ["CLIENT_WRITE"],
  workflow: ["CLIENT_WRITE"],
  trading: ["CLIENT_WRITE", "FINANCIAL_PII_VIEW"],
  portfolio: ["CLIENT_WRITE", "FINANCIAL_PII_VIEW"],
  documents: ["CLIENT_WRITE"],
  planning: ["CLIENT_WRITE", "FINANCIAL_PII_VIEW"],
  integrations: ["CLIENT_WRITE"],
  billing: ["USER_MANAGE"],
  meetings: ["CLIENT_WRITE"],
  compliance_rules: ["COMPLIANCE_RESOLVE"],
  copilot: ["AI_GENERATION"],
  agents: ["AI_GENERATION"],
  documents_upload: ["CLIENT_WRITE"],
  opportunities_scan: ["CLIENT_WRITE", "AI_GENERATION"],
  custodian_integrations: ["CLIENT_WRITE", "FINANCIAL_PII_VIEW"],
  stripe: ["USER_MANAGE"],
  visualizations: ["CLIENT_VIEW", "AI_GENERATION"],
  scenario: ["CLIENT_VIEW", "AI_GENERATION"],
  org_settings: ["USER_MANAGE"],
};

export function requiredCapabilitiesForApiResource(
  action: "read" | "write",
  resource: string,
): Capability[] | null {
  const map = action === "read" ? READ_MATRIX : WRITE_MATRIX;
  return map[resource] ?? null;
}
