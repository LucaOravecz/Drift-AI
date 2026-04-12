import { NextResponse } from "next/server";
import { ScenarioService } from "@/lib/services/scenario.service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientId, scenarioType, magnitude, timelineMonths } = body;

    if (!clientId || !scenarioType || !magnitude) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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
