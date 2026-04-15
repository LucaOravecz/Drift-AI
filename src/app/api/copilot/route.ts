import "server-only"

import { NextResponse } from "next/server"
import { runCopilot } from "@/lib/services/copilot.service"
import { authenticateApiRequest } from "@/lib/middleware/api-auth"
import { getActiveSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    // Authenticate — session or API key
    const session = await getActiveSession()
    let organizationId: string

    if (session) {
      organizationId = session.user.organizationId
    } else {
      const auth = await authenticateApiRequest()
      if (!auth.authenticated || !auth.context) {
        return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 })
      }
      organizationId = auth.context.organizationId
    }

    const body = await request.json()
    const { prompt } = body

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 })
    }

    const response = await runCopilot(prompt.trim(), organizationId)
    return NextResponse.json(response)
  } catch (err) {
    console.error("[CopilotRoute] Error:", err)
    return NextResponse.json({ error: "Copilot request failed" }, { status: 500 })
  }
}
