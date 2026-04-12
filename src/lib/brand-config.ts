export type BrandingSnapshot = {
  wordmark: string;
  shortName: string;
  productName: string;
  tagline: string;
  logoImagePath: string | null;
  iconFallbackText: string;
  iconColorClass: string;
  iconTextColorClass: string;
  accentColor: string;
  supportEmail: string | null;
  notificationsEmail: string | null;
};

export type ThemeVariant = {
  name: string;
  primaryColor: string;
  primaryHex: string;
  accentColor: string;
  accentHex: string;
  colorScheme: 'light' | 'dark' | 'auto';
  typography: {
    fontFamily: string;
    fontSize: string;
  };
};

/**
 * Drift AI — Centralized Brand Configuration
 * Replace values here to update all branding across the app.
 * Use generateThemeVariant() to dynamically create custom themes.
 */

export const BRAND = {
  /** Primary wordmark shown in sidebar and headers */
  wordmark: "Drift OS",
  /** Short name used in breadcrumbs / page titles */
  shortName: "Drift",
  /** Full product name */
  productName: "Drift Intelligence Platform",
  /** Tagline shown in login / splash screens */
  tagline: "AI Operating System for Financial Firms",
  /** Favicon emoji fallback (used when no logo image exists) */
  faviconEmoji: "⚡",
  /**
   * Logo image path (relative to /public).
   * Set to null to use the icon fallback.
   */
  logoImagePath: null as string | null,
  /**
   * Icon fallback letter(s) shown inside the colored square when no logo image.
   * Remove this and set logoImagePath when a real logo is available.
   */
  iconFallbackText: "",
  /** Accent color class applied to the logo icon container */
  iconColorClass: "bg-primary",
  /** Text color inside the icon */
  iconTextColorClass: "text-primary-foreground",
  /** Accent hex used by database-backed branding settings as a fallback */
  accentColor: "#4f46e5",
} as const;

/**
 * Theme variants for different financial advisor personas.
 * Each variant has optimized colors, typography, and visual hierarchy.
 */
export const THEME_VARIANTS: Record<string, ThemeVariant> = {
  default: {
    name: "Professional",
    primaryColor: "primary",
    primaryHex: "#4f46e5",
    accentColor: "accent",
    accentHex: "#7c3aed",
    colorScheme: "auto",
    typography: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "14px",
    },
  },
  conservative: {
    name: "Conservative Blue",
    primaryColor: "blue-600",
    primaryHex: "#2563eb",
    accentColor: "blue-800",
    accentHex: "#1e40af",
    colorScheme: "light",
    typography: {
      fontFamily: "Georgia, serif",
      fontSize: "15px",
    },
  },
  modern: {
    name: "Modern Slate",
    primaryColor: "slate-900",
    primaryHex: "#0f172a",
    accentColor: "indigo-500",
    accentHex: "#6366f1",
    colorScheme: "dark",
    typography: {
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      fontSize: "14px",
    },
  },
  tech: {
    name: "Tech Forward",
    primaryColor: "purple-600",
    primaryHex: "#9333ea",
    accentColor: "cyan-500",
    accentHex: "#06b6d4",
    colorScheme: "dark",
    typography: {
      fontFamily: "'Menlo', 'Monaco', monospace",
      fontSize: "13px",
    },
  },
};

/**
 * Generate a custom theme variant with specified colors and typography.
 * Useful for firm-specific branding or client portal customization.
 */
export function generateThemeVariant(
  name: string,
  primaryHex: string,
  accentHex: string,
  options?: Partial<ThemeVariant>
): ThemeVariant {
  return {
    name,
    primaryColor: "custom-primary",
    primaryHex,
    accentColor: "custom-accent",
    accentHex,
    colorScheme: options?.colorScheme ?? "auto",
    typography: {
      fontFamily: options?.typography?.fontFamily ?? "system-ui, -apple-system, sans-serif",
      fontSize: options?.typography?.fontSize ?? "14px",
    },
  };
}

export type BrandConfig = typeof BRAND;
