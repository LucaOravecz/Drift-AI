import "server-only";

import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { AuditEventService } from "@/lib/services/audit-event.service";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "read", "clients")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "100");

    const clients = await prisma.client.findMany({
      where: {
        organizationId: auth.context.organizationId,
        deletedAt: null,
      },
      include: { intelligence: true },
      orderBy: { createdAt: "desc" },
      take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 100,
    });
    return NextResponse.json(clients);
  } catch (error) {
    console.error("Failed to fetch clients:", error);
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "clients")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const newClient = await prisma.client.create({
      data: {
        organizationId: auth.context.organizationId,
        name: body.name,
        type: body.type || "INDIVIDUAL",
        aum: body.aum || 0,
        riskProfile: body.riskProfile || "MODERATE",
      },
    });

    await AuditEventService.appendEvent({
      organizationId: auth.context.organizationId,
      userId: auth.context.userId,
      action: "CLIENT_CREATED_API",
      target: "Client",
      targetId: newClient.id,
      details: `Client ${newClient.name} was created via the legacy clients API.`,
      afterState: {
        id: newClient.id,
        name: newClient.name,
        type: newClient.type,
        aum: newClient.aum,
        riskProfile: newClient.riskProfile,
      },
      severity: "INFO",
    });

    return NextResponse.json(newClient, { status: 201 });
  } catch (error) {
    console.error("Failed to create client:", error);
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
}
