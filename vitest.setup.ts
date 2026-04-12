import { beforeAll, afterAll, afterEach } from "vitest";
import prisma from "./src/lib/db";

// Global test setup
beforeAll(async () => {
  // Ensure test database is connected
  await prisma.$connect();
});

afterEach(async () => {
  // Clean up test data between tests (order matters for FK constraints)
  const tablenames = [
    "ai_usage_records",
    "outbound_webhooks",
    "compliance_rules",
    "integration_configs",
    "api_keys",
    "subscriptions",
    "audit_events",
    "compliance_flags",
    "audit_logs",
    "client_memory_snapshots",
    "sentiment_snapshots",
    "holdings",
    "financial_accounts",
    "tasks",
    "onboarding_steps",
    "onboarding_workflows",
    "research_memos",
    "investment_insights",
    "tax_insights",
    "communications",
    "relationship_events",
    "life_events",
    "meetings",
    "documents",
    "client_tags",
    "tags",
    "opportunities",
    "campaigns",
    "prospects",
    "intelligence_profiles",
    "notifications",
    "user_preferences",
    "user_sessions",
    "pending_login_challenges",
    "user_invites",
    "clients",
    "users",
    "organization_settings",
    "organizations",
  ];

  for (const table of tablenames) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE true`).catch(() => {});
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
