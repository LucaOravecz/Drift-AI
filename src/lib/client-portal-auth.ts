import { createHash, timingSafeEqual } from "crypto";

export const CLIENT_PORTAL_ACCESS_CODE_HASH_ENV = "CLIENT_PORTAL_ACCESS_CODE_HASH";

export function hashClientPortalAccessCode(accessCode: string): string {
  return createHash("sha256").update(accessCode).digest("hex");
}

export function accessCodeMatchesHash(accessCode: string, expectedHash: string | null | undefined): boolean {
  if (!expectedHash) return false;

  const normalizedHash = expectedHash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedHash)) return false;

  const providedHash = Buffer.from(hashClientPortalAccessCode(accessCode), "hex");
  const storedHash = Buffer.from(normalizedHash, "hex");

  if (providedHash.length !== storedHash.length) return false;
  return timingSafeEqual(providedHash, storedHash);
}
