export const DEMO_MODE_ENV = "DEMO_MODE";

function isTruthy(value: string | null | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function isDemoModeEnabled() {
  return isTruthy(process.env[DEMO_MODE_ENV] ?? process.env.NEXT_PUBLIC_DEMO_MODE);
}

export function getDemoModeMessage(actionLabel: string) {
  return `${actionLabel} is locked while demo-safe mode is enabled.`;
}

export function assertDemoModeWriteAllowed(actionLabel: string) {
  if (isDemoModeEnabled()) {
    throw new Error(getDemoModeMessage(actionLabel));
  }
}
