/**
 * Feature flags for product simplification.
 *
 * Flags can be toggled via environment variables (FEATURE_<FLAG>=true|false)
 * or programmatically. This allows hiding unfinished features from the nav
 * while keeping routes functional for direct access.
 */

function isTruthy(value: string | null | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

type FlagName =
  | "AUDIT_TRAIL"
  | "ONBOARDING_WIZARD"
  | "ADMIN_PANEL"
  | "WORKFLOWS"
  | "HISTORY"
  | "DOCUMENT_REVIEW";

const DEFAULTS: Record<FlagName, boolean> = {
  AUDIT_TRAIL: false,
  ONBOARDING_WIZARD: false,
  ADMIN_PANEL: true, // admin-only, always available to admins
  WORKFLOWS: false,
  HISTORY: false,
  DOCUMENT_REVIEW: true, // used by vault, keep enabled
};

function envKey(flag: FlagName) {
  return `FEATURE_${flag}`;
}

export function isFeatureEnabled(flag: FlagName): boolean {
  const envVal = process.env[envKey(flag)] ?? process.env[`NEXT_PUBLIC_${envKey(flag)}`];
  if (envVal !== undefined) return isTruthy(envVal);
  return DEFAULTS[flag];
}

export function getDisabledFlags(): FlagName[] {
  return (Object.keys(DEFAULTS) as FlagName[]).filter((f) => !isFeatureEnabled(f));
}
