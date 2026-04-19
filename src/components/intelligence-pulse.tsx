"use client";

interface IntelligencePulseProps {
  summary: {
    clientCount: number;
    upcomingMeetingCount: number;
    pendingVaultCount: number;
    unreadNotificationCount: number;
    activeSessionCount: number;
  };
}

/** Compact pulse strip for advisor workspace counts (shell header). */
export function IntelligencePulse({ summary }: IntelligencePulseProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span>{summary.clientCount} clients</span>
      <span className="opacity-40">·</span>
      <span>{summary.upcomingMeetingCount} upcoming</span>
      <span className="opacity-40">·</span>
      <span>{summary.pendingVaultCount} in vault</span>
    </div>
  );
}
