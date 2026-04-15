import "server-only";

import { NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * GET /api/health — load balancer / ops probe (no auth).
 * Verifies database connectivity only.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      database: "up",
      at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        database: "down",
        at: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
