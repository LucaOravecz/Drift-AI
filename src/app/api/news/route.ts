import { NextResponse } from "next/server";
import { NewsService } from "@/lib/services/news.service";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const org = await prisma.organization.findFirst();
    if (!org) return NextResponse.json({ signals: [], events: [] });

    const [signals, events] = await Promise.all([
      Promise.resolve(NewsService.getLatestSignals()),
      NewsService.runNewsOracle(org.id),
    ]);

    return NextResponse.json({ signals, events });
  } catch (error) {
    console.error("[NewsAPI]", error);
    return NextResponse.json({ error: "News Oracle failed" }, { status: 500 });
  }
}
