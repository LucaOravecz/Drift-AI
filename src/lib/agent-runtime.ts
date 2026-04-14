export const ON_DEMAND_AGENT_SETTLE_MS = 8_000;

export function shouldAutoCompleteAgentTask(
  startedAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!startedAt) return false;
  return now.getTime() - startedAt.getTime() >= ON_DEMAND_AGENT_SETTLE_MS;
}

export function buildAgentRunOutput(description: string): string {
  return JSON.stringify({
    success: true,
    message: "On-demand run completed successfully.",
    summary: description,
  });
}
