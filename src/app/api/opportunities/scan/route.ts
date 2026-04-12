import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { detectClientOpportunities } from "@/lib/engines/opportunity.engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId } = body;
    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, organizationId: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const detected = await detectClientOpportunities(clientId);
    let created = 0;

    for (const signal of detected) {
      const existing = await prisma.opportunity.findFirst({
        where: {
          clientId,
          type: signal.type,
          suggestedAction: signal.suggestedAction,
          status: { not: "REJECTED" },
        },
      });

      if (existing) continue;

      await prisma.opportunity.create({
        data: {
          clientId,
          type: signal.type,
          valueEst: null,
          confidence: signal.confidence === "HIGH" ? 92 : signal.confidence === "MEDIUM" ? 78 : 62,
          description: `${signal.title}. Triggered by rule: ${signal.triggerRule}.`,
          evidence: signal.triggerData,
          reasoning: JSON.stringify({
            triggerRule: signal.triggerRule,
            evidence: signal.evidence,
            missingData: signal.missingData,
          }),
          suggestedAction: signal.suggestedAction,
          status: "DRAFT",
          riskLevel: signal.urgency === "HIGH" ? "HIGH" : "LOW",
        },
      });
      created += 1;
    }

    await prisma.auditLog.create({
      data: {
        organizationId: client.organizationId,
        action: "DETERMINISTIC_OPPORTUNITY_SCAN_API",
        target: `Client:${client.id}`,
        details: created > 0
          ? `Created ${created} grounded opportunity record(s) for ${client.name}.`
          : `No new grounded opportunities triggered for ${client.name}.`,
        severity: "INFO",
        aiInvolved: false,
      },
    });

    return NextResponse.json({
      message: created > 0
        ? "Deterministic opportunity scan completed."
        : "No new opportunities triggered from stored data.",
      opportunitiesDetected: created,
    }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Intelligence Engine Error" }, { status: 500 });
  }
}
