import { randomUUID, scryptSync, timingSafeEqual } from "crypto";

function hashSecret(secret: string, salt: string) {
  return scryptSync(secret, salt, 64).toString("hex");
}

export function createPasswordHash(password: string) {
  const salt = randomUUID();
  return `${salt}:${hashSecret(password, salt)}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const derived = Buffer.from(hashSecret(password, salt), "hex");
  const original = Buffer.from(key, "hex");
  return derived.length === original.length && timingSafeEqual(derived, original);
}
