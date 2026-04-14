import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { CLIENT_PORTAL_ACCESS_CODE_HASH_ENV, hashClientPortalAccessCode } from "./src/lib/client-portal-auth";

const PLAYWRIGHT_ACCESS_CODE = "playwright-demo-code";
const PLAYWRIGHT_ACCESS_CODE_HASH = hashClientPortalAccessCode(PLAYWRIGHT_ACCESS_CODE);
const PLAYWRIGHT_SETUP_LOCK = join(process.cwd(), "playwright/.setup-lock");

async function withSetupLock<T>(fn: () => Promise<T>): Promise<T> {
  for (;;) {
    try {
      mkdirSync(PLAYWRIGHT_SETUP_LOCK, { recursive: false });
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("EEXIST")) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  try {
    return await fn();
  } finally {
    rmSync(PLAYWRIGHT_SETUP_LOCK, { recursive: true, force: true });
  }
}

export default async function globalSetup() {
  await withSetupLock(async () => {
    execSync("npm run db:seed", {
      stdio: "inherit",
      env: {
        ...process.env,
        [CLIENT_PORTAL_ACCESS_CODE_HASH_ENV]: process.env[CLIENT_PORTAL_ACCESS_CODE_HASH_ENV] ?? PLAYWRIGHT_ACCESS_CODE_HASH,
      },
    });

    const prisma = new PrismaClient();
    const admin = await prisma.user.findUnique({
      where: { email: "admin@drift.ai" },
    });

    if (!admin) {
      await prisma.$disconnect();
      throw new Error("Seeded admin user not found for Playwright auth state.");
    }

    await prisma.userSession.deleteMany({
      where: { userId: admin.id },
    });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await prisma.userSession.create({
      data: {
        userId: admin.id,
        token,
        expiresAt,
        userAgent: "Playwright",
        ipAddress: "127.0.0.1",
      },
    });

    mkdirSync(join(process.cwd(), "playwright/.auth"), { recursive: true });
    writeFileSync(
      join(process.cwd(), "playwright/.auth/admin.json"),
      JSON.stringify(
        {
          cookies: [
            {
              name: "drift_session",
              value: token,
              domain: "127.0.0.1",
              path: "/",
              expires: Math.floor(expiresAt.getTime() / 1000),
              httpOnly: true,
              secure: false,
              sameSite: "Lax",
            },
          ],
          origins: [],
        },
        null,
        2,
      ),
    );

    await prisma.$disconnect();

    execSync("npm run build", {
      stdio: "inherit",
      env: {
        ...process.env,
        [CLIENT_PORTAL_ACCESS_CODE_HASH_ENV]: process.env[CLIENT_PORTAL_ACCESS_CODE_HASH_ENV] ?? PLAYWRIGHT_ACCESS_CODE_HASH,
      },
    });
  });
}
