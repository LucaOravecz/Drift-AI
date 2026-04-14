/**
 * Anniversary tracking utilities for life events
 * Calculates, tracks, and checks anniversary dates for advisor reminders
 */

/**
 * Calculates the next occurrence of an annual anniversary from an original date
 * @param originalDate - The original date of the life event (e.g., child's birth)
 * @returns The next upcoming anniversary date, or null if originalDate is null
 */
export function calculateNextAnniversaryDate(
  originalDate: Date | null | undefined
): Date | null {
  if (!originalDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison

  // Try this year's anniversary
  const thisYearAnniversary = new Date(
    today.getFullYear(),
    originalDate.getMonth(),
    originalDate.getDate()
  );

  // If this year's anniversary hasn't passed, return it
  if (thisYearAnniversary >= today) {
    return thisYearAnniversary;
  }

  // Otherwise, return next year's anniversary
  return new Date(
    today.getFullYear() + 1,
    originalDate.getMonth(),
    originalDate.getDate()
  );
}

/**
 * Calculates the number of days until an anniversary date
 * @param nextAnniversaryDate - The upcoming anniversary date
 * @returns The number of days until the anniversary, or null if date is null
 */
export function daysUntilAnniversary(
  nextAnniversaryDate: Date | null | undefined
): number | null {
  if (!nextAnniversaryDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day

  const anniversaryDate = new Date(nextAnniversaryDate);
  anniversaryDate.setHours(0, 0, 0, 0);

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil(
    (anniversaryDate.getTime() - today.getTime()) / millisecondsPerDay
  );
}

/**
 * Checks if an anniversary is within a specified window of days
 * Useful for triggering reminders before anniversaries
 * @param nextAnniversaryDate - The upcoming anniversary date
 * @param dayWindow - The number of days before anniversary to trigger (default: 30)
 * @returns true if anniversary is within window and in the future
 */
export function isAnniversaryWithinWindow(
  nextAnniversaryDate: Date | null | undefined,
  dayWindow: number = 30
): boolean {
  const days = daysUntilAnniversary(nextAnniversaryDate);
  return days !== null && days >= 0 && days <= dayWindow;
}

/**
 * Formats an anniversary date for display (e.g., "May 15")
 * @param date - The date to format
 * @returns Formatted string like "May 15"
 */
export function formatAnniversaryDate(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric"
  });
}

/**
 * Gets a human-readable description of days until anniversary
 * @param daysUntil - Number of days until anniversary
 * @returns Formatted string like "in 15 days", "today", "overdue"
 */
export function getAnniversaryCountdownText(daysUntil: number | null): string {
  if (daysUntil === null) return "unknown";
  if (daysUntil < 0) return "overdue";
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "in 1 day";
  return `in ${daysUntil} days`;
}
