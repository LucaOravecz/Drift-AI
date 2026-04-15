import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import { MeetingWorkflowService } from "@/lib/services/meeting-workflow.service";

const bodySchema = z.object({
  meetingId: z.string().min(1),
  notes: z.string().trim().min(1).optional(),
});

export async function POST(req: Request) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "meetings")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  if (!auth.context.userId) {
    return NextResponse.json({ error: "A signed-in user is required to complete meetings." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await MeetingWorkflowService.completeMeeting({
      organizationId: auth.context.organizationId,
      userId: auth.context.userId,
      meetingId: parsed.data.meetingId,
      notes: parsed.data.notes,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to complete meeting";
    const status =
      message.includes("already been completed") ? 409 :
      message.includes("not found") ? 404 :
      message.includes("does not belong") ? 403 :
      message.includes("plan") ? 402 :
      500;

    return NextResponse.json({ error: message }, { status });
  }
}
