import "server-only"

import { NextRequest } from "next/server"
import { runCopilot } from "@/lib/services/copilot.service"
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth"
import { OrgOperationalSettings } from "@/lib/org-operational-settings"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest()
    if (!auth.authenticated || !auth.context) {
      return new Response(JSON.stringify({ error: auth.error }), { status: auth.statusCode ?? 401 })
    }

    if (!hasPermission(auth.context, "write", "copilot")) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), { status: 403 })
    }

    try {
      await OrgOperationalSettings.assertAiEnabled(auth.context.organizationId)
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI disabled"
      return new Response(JSON.stringify({ error: message }), { status: 403 })
    }

    const body = await request.json()
    const { prompt } = body

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "prompt is required" }), { status: 400 })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (payload: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        }

        try {
          const response = await runCopilot(prompt.trim(), auth.context!.organizationId, (event) => {
            sendEvent(event)
          })
          sendEvent({ type: "complete", response })
        } catch (err) {
          console.error("[CopilotStreamRoute] Error:", err)
          sendEvent({ type: "error", message: "Copilot request failed" })
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    })
  } catch (err) {
    console.error("[CopilotStreamRoute] Global Error:", err)
    return new Response(JSON.stringify({ error: "Stream initialization failed" }), { status: 500 })
  }
}
