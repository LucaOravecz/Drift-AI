export type TrustTone = "emerald" | "amber" | "rose" | "zinc";

export interface TrustStatusItem {
  label: string;
  value: string;
  detail: string;
  tone: TrustTone;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function describeFreshness(latestSyncAt: string | null | undefined, reference = new Date()): TrustStatusItem {
  if (!latestSyncAt) {
    return {
      label: "Data Freshness",
      value: "No sync history",
      detail: "Run a connector sync before using freshness claims in a walkthrough.",
      tone: "amber",
    };
  }

  const latest = new Date(latestSyncAt);
  const diffMs = Math.max(0, reference.getTime() - latest.getTime());
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes <= 15) {
    return {
      label: "Data Freshness",
      value: "Updated within 15 min",
      detail: `Last confirmed sync at ${latest.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}.`,
      tone: "emerald",
    };
  }

  if (diffMinutes <= 60) {
    return {
      label: "Data Freshness",
      value: `Updated ${diffMinutes} min ago`,
      detail: "Fresh enough for most walkthroughs, but worth calling out if someone asks about live timing.",
      tone: "amber",
    };
  }

  const diffHours = Math.round(diffMinutes / 60);
  return {
    label: "Data Freshness",
    value: `Updated ${diffHours} hr ago`,
    detail: "The environment is still usable, but refresh before making real-time claims.",
    tone: "rose",
  };
}

export function describeActionMode(demoMode: boolean, lockedActions: string[]): TrustStatusItem {
  if (demoMode) {
    return {
      label: "Action Safety",
      value: "Demo-safe mode on",
      detail: `${pluralize(lockedActions.length, "action")} locked: ${lockedActions.join(", ")}.`,
      tone: "amber",
    };
  }

  return {
    label: "Action Safety",
    value: "Live actions enabled",
    detail: "Changes, approvals, and sync operations are available to authorized users.",
    tone: "emerald",
  };
}

export function describeCoverage(liveCount: number, partialCount: number, plannedCount: number): TrustStatusItem {
  return {
    label: "Coverage",
    value: `${liveCount} live / ${partialCount} partial`,
    detail: `${plannedCount} planned connector${plannedCount === 1 ? "" : "s"} still need implementation or credentials.`,
    tone: plannedCount > 0 ? "amber" : "emerald",
  };
}

export function describePulse(healthyCount: number, watchCount: number): TrustStatusItem {
  return {
    label: "Integration Pulse",
    value: `${healthyCount} healthy / ${watchCount} watchlist`,
    detail: watchCount > 0
      ? "Use the watchlist count to frame follow-up work instead of over-claiming readiness."
      : "All tracked connectors are reporting healthy status right now.",
    tone: watchCount > 0 ? "amber" : "emerald",
  };
}
