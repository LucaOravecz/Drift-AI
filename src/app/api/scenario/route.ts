import "server-only";

import { NextResponse } from "next/server";
import { ScenarioService } from "@/lib/services/scenario.service";
import prisma from "@/lib/db";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";

export async function POST(req: Request) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "scenario")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { clientId, scenarioType, magnitude, timelineMonths } = body;

    if (!clientId || !scenarioType || !magnitude) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { organizationId: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (client.organizationId !== auth.context.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await ScenarioService.runScenario({
      clientId,
      scenarioType,
      magnitude: Number(magnitude),
      timelineMonths: Number(timelineMonths ?? 6),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ScenarioAPI]", error);
    return NextResponse.json({ error: "Scenario model failed" }, { status: 500 });
  }
}
