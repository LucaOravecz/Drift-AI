/**
 * True when Prisma cannot reach the database (dev: Postgres not running, wrong URL, etc.).
 * Uses duck-typing so we do not depend on runtime error class re-exports from `@prisma/client`.
 */
export function isDatabaseConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: string; code?: string; message?: string };
  if (e.name === "PrismaClientInitializationError") return true;
  if (e.code === "P1001" || e.code === "P1017") return true;
  if (typeof e.message === "string" && e.message.includes("Can't reach database server")) return true;
  return false;
}
