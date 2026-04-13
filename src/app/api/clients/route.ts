import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("organizationId");

    if (!orgId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const clients = await prisma.client.findMany({
      where: { organizationId: orgId },
      include: { intelligence: true },
    });
    return NextResponse.json(clients);
  } catch (error) {
    console.error("Failed to fetch clients:", error);
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.organizationId || !body.name) {
      return NextResponse.json({ error: "organizationId and name are required" }, { status: 400 });
    }

    const newClient = await prisma.client.create({
      data: {
        organizationId: body.organizationId,
        name: body.name,
        type: body.type || "INDIVIDUAL",
        aum: body.aum || 0,
        riskProfile: body.riskProfile || "MODERATE",
      },
    });

    return NextResponse.json(newClient, { status: 201 });
  } catch (error) {
    console.error("Failed to create client:", error);
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
}
