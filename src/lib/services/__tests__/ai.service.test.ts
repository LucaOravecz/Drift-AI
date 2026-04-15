import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { aiUsageCreate } = vi.hoisted(() => ({
  aiUsageCreate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  default: {
    aiUsageRecord: {
      create: aiUsageCreate,
    },
  },
}));

vi.mock("@/lib/org-operational-settings", () => ({
  OrgOperationalSettings: {
    assertAiEnabled: vi.fn().mockResolvedValue(undefined),
  },
}));

import { callClaude, callClaudeJSON } from "@/lib/services/ai.service";

describe("ai service", () => {
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    aiUsageCreate.mockClear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.OPENROUTER_API_KEY = originalApiKey;
    global.fetch = originalFetch;
  });

  it("fails fast when the OpenRouter API key is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as typeof fetch;

    await expect(
      callClaude("system", "user", { organizationId: "org_123" }),
    ).rejects.toThrow("OPENROUTER_API_KEY is not configured");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(aiUsageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org_123",
          success: false,
          errorMessage: "OPENROUTER_API_KEY is not configured",
        }),
      }),
    );
  });

  it("parses JSON responses wrapped in markdown fences", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      json: async () => ({
        id: "req_123",
        choices: [
          {
            message: {
              content: '```json\n{"subject":"Hello","body":"World"}\n```',
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
        },
      }),
    } satisfies Partial<Response>) as typeof fetch;

    const result = await callClaudeJSON<{ subject: string; body: string }>("system", "user", {
      organizationId: "org_123",
    });

    expect(result).toEqual({ subject: "Hello", body: "World" });
    expect(aiUsageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org_123",
          success: true,
          requestId: "req_123",
        }),
      }),
    );
  });
});
