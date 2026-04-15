import "server-only";

import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import prisma from "@/lib/db";

/**
 * GET /api/v1/clients — List clients
 * POST /api/v1/clients — Create a client
 */
export async function GET() {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "read", "clients")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const clients = await prisma.client.findMany({
    where: {
      organizationId: auth.context.organizationId,
      deletedAt: null,
    },
    include: {
      intelligence: true,
      clientTags: { include: { tag: true } },
      accounts: { include: { holdings: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    data: clients,
    count: clients.length,
  });
}

export async function POST(request: Request) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "clients")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();

  const client = await prisma.client.create({
    data: {
      organizationId: auth.context.organizationId,
      name: body.name,
      email: body.email,
      phone: body.phone,
      type: body.type ?? "INDIVIDUAL",
      riskProfile: body.riskProfile,
      householdId: body.householdId,
    },
  });

  return NextResponse.json({ data: client }, { status: 201 });
}
