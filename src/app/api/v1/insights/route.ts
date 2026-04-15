import "server-only";

import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import prisma from "@/lib/db";

/**
 * GET /api/v1/insights — List tax + investment insights
 */
export async function GET() {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "read", "tax_insights")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const [taxInsights, investmentInsights] = await Promise.all([
    prisma.taxInsight.findMany({
      where: {
        client: { organizationId: auth.context.organizationId },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.investmentInsight.findMany({
      where: {
        client: { organizationId: auth.context.organizationId },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    data: { taxInsights, investmentInsights },
    count: { tax: taxInsights.length, investment: investmentInsights.length },
  });
}
