import "server-only";

import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import prisma from "@/lib/db";

/**
 * GET /api/v1/opportunities — List opportunities
 */
export async function GET() {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "read", "opportunities")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const opportunities = await prisma.opportunity.findMany({
    where: {
      client: { organizationId: auth.context.organizationId },
      deletedAt: null,
    },
    include: { client: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    data: opportunities,
    count: opportunities.length,
  });
}
