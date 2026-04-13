/**
 * Consistent date formatting utilities across the application
 */

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

/**
 * Format date as "Jan 15, 2024"
 */
export function formatDate(date: Date | string | number): string {
  try {
    return dateFormatter.format(new Date(date));
  } catch {
    return "Invalid date";
  }
}

/**
 * Format time as "02:30 PM"
 */
export function formatTime(date: Date | string | number): string {
  try {
    return timeFormatter.format(new Date(date));
  } catch {
    return "Invalid time";
  }
}

/**
 * Format date and time as "Jan 15, 2024, 02:30 PM"
 */
export function formatDateTime(date: Date | string | number): string {
  try {
    return dateTimeFormatter.format(new Date(date));
  } catch {
    return "Invalid date and time";
  }
}

/**
 * Format date relative to now (e.g., "2 hours ago", "In 3 days")
 */
export function formatRelative(date: Date | string | number): string {
  const now = new Date();
  const targetDate = new Date(date);
  const diffMs = targetDate.getTime() - now.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 0) {
    // Past dates
    const absDiffSecs = Math.abs(diffSecs);
    const absDiffMins = Math.floor(absDiffSecs / 60);
    const absDiffHours = Math.floor(absDiffMins / 60);
    const absDiffDays = Math.floor(absDiffHours / 24);

    if (absDiffSecs < 60) return "just now";
    if (absDiffMins < 60) return `${absDiffMins}m ago`;
    if (absDiffHours < 24) return `${absDiffHours}h ago`;
    if (absDiffDays < 7) return `${absDiffDays}d ago`;
  } else {
    // Future dates
    if (diffSecs < 60) return "in a moment";
    if (diffMins < 60) return `in ${diffMins}m`;
    if (diffHours < 24) return `in ${diffHours}h`;
    if (diffDays < 7) return `in ${diffDays}d`;
  }

  return formatDate(date);
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}
