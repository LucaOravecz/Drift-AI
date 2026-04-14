import { describe, expect, it } from "vitest";
import { ON_DEMAND_AGENT_SETTLE_MS, shouldAutoCompleteAgentTask } from "@/lib/agent-runtime";

describe("agent runtime helpers", () => {
  it("does not complete tasks without a start time", () => {
    expect(shouldAutoCompleteAgentTask(null)).toBe(false);
  });

  it("waits until the settle window elapses", () => {
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const almostReady = new Date(startedAt.getTime() + ON_DEMAND_AGENT_SETTLE_MS - 1);
    expect(shouldAutoCompleteAgentTask(startedAt, almostReady)).toBe(false);
  });

  it("completes tasks once the settle window has elapsed", () => {
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const readyAt = new Date(startedAt.getTime() + ON_DEMAND_AGENT_SETTLE_MS);
    expect(shouldAutoCompleteAgentTask(startedAt, readyAt)).toBe(true);
  });
});
