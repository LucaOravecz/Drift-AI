import "server-only"

import { NextResponse } from "next/server"
import { runCopilot } from "@/lib/services/copilot.service"
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth"
import { OrgOperationalSettings } from "@/lib/org-operational-settings"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const auth = await authenticateApiRequest()
    if (!auth.authenticated || !auth.context) {
      return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 })
    }

    if (!hasPermission(auth.context, "write", "copilot")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    try {
      await OrgOperationalSettings.assertAiEnabled(auth.context.organizationId)
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI disabled"
      return NextResponse.json({ error: message }, { status: 403 })
    }

    const body = await request.json()
    const { prompt } = body

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 })
    }

    const response = await runCopilot(prompt.trim(), auth.context.organizationId)
    return NextResponse.json(response)
  } catch (err) {
    console.error("[CopilotRoute] Error:", err)
    return NextResponse.json({ error: "Copilot request failed" }, { status: 500 })
  }
}
