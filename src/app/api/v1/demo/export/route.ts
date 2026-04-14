import { NextResponse } from "next/server";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { demoWalkthroughTracks, type DemoTrackId } from "@/lib/demo-walkthrough";
import prisma from "@/lib/db";
import { DemoBriefExportService } from "@/lib/services/demo-brief-export.service";

export async function POST(request: Request) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "documents")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json();
  const trackId = body.trackId as DemoTrackId | undefined;
  const personaId = body.personaId as string | undefined;

  if (!trackId || !(trackId in demoWalkthroughTracks) || !personaId) {
    return NextResponse.json({ error: "trackId and personaId are required" }, { status: 400 });
  }

  const track = demoWalkthroughTracks[trackId];
  const personaExists = track.personas.some((persona) => persona.id === personaId);
  if (!personaExists) {
    return NextResponse.json({ error: "Unknown persona for selected track" }, { status: 400 });
  }

  const organization = await prisma.organization.findUnique({
    where: { id: auth.context.organizationId },
    select: { name: true },
  });

  const user = auth.context.userId
    ? await prisma.user.findUnique({
        where: { id: auth.context.userId },
        select: { name: true, email: true },
      })
    : null;

  const result = await DemoBriefExportService.generatePdf({
    organizationName: organization?.name ?? "Drift AI",
    trackId,
    personaId,
    generatedBy: user?.name ?? user?.email ?? "Drift user",
  });

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
    },
  });
}
