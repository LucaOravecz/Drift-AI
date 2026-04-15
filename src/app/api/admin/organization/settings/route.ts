import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
import prisma from "@/lib/db";

const patchSchema = z.object({
  aiFeaturesEnabled: z.boolean().optional(),
  readOnlyMode: z.boolean().optional(),
  syncDriftAlertBps: z.number().int().min(1).max(5000).optional(),
});

/**
 * GET/PATCH /api/admin/organization/settings — firm operational flags (admin).
 */
export async function GET() {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "read", "org_settings")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const settings = await prisma.organizationSettings.findUnique({
    where: { organizationId: auth.context.organizationId },
    select: {
      aiFeaturesEnabled: true,
      readOnlyMode: true,
      syncDriftAlertBps: true,
    },
  });

  return NextResponse.json({
    data: {
      aiFeaturesEnabled: settings?.aiFeaturesEnabled ?? true,
      readOnlyMode: settings?.readOnlyMode ?? false,
      syncDriftAlertBps: settings?.syncDriftAlertBps ?? 50,
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 });
  }

  if (!hasPermission(auth.context, "write", "org_settings")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const organizationId = auth.context.organizationId;

  const updated = await prisma.organizationSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      aiFeaturesEnabled: parsed.data.aiFeaturesEnabled ?? true,
      readOnlyMode: parsed.data.readOnlyMode ?? false,
      syncDriftAlertBps: parsed.data.syncDriftAlertBps ?? 50,
    },
    update: {
      ...(parsed.data.aiFeaturesEnabled !== undefined
        ? { aiFeaturesEnabled: parsed.data.aiFeaturesEnabled }
        : {}),
      ...(parsed.data.readOnlyMode !== undefined ? { readOnlyMode: parsed.data.readOnlyMode } : {}),
      ...(parsed.data.syncDriftAlertBps !== undefined
        ? { syncDriftAlertBps: parsed.data.syncDriftAlertBps }
        : {}),
    },
    select: {
      aiFeaturesEnabled: true,
      readOnlyMode: true,
      syncDriftAlertBps: true,
    },
  });

  return NextResponse.json({ data: updated });
}
