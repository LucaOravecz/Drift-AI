import "server-only"
import { NextResponse } from "next/server"
import { authenticateApiRequest } from "@/lib/middleware/api-auth"
import { z } from "zod"

const bodySchema = z.object({
  provider: z.enum(["SCHWAB", "FIDELITY"]),
})

/**
 * POST /api/v1/integrations/custodian/init
 *
 * Initiate OAuth2 flow to Schwab or Fidelity.
 * Returns the authorization URL that the client should redirect to.
 */
export async function POST(req: Request) {
  const auth = await authenticateApiRequest()
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 })
  }

  try {
    const body = await req.json()
    const parsed = bodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { provider } = parsed.data
    const organizationId = auth.context!.organizationId

    const state = crypto.getRandomValues(new Uint8Array(32))
    const stateStr = Buffer.from(state).toString("hex")

    let authUrl = ""

    if (provider === "SCHWAB") {
      const clientId = process.env.SCHWAB_CLIENT_ID
      const redirectUri = process.env.SCHWAB_REDIRECT_URI

      if (!clientId || !redirectUri) {
        return NextResponse.json({ error: "Schwab OAuth not configured" }, { status: 500 })
      }

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "PlaceTrades AccountAccess MoveMoney",
        state: stateStr,
      })

      authUrl = `https://login.schwabapi.com/v1/oauth/authorize?${params}`
    } else if (provider === "FIDELITY") {
      const clientId = process.env.FIDELITY_CLIENT_ID
      const redirectUri = process.env.FIDELITY_REDIRECT_URI

      if (!clientId || !redirectUri) {
        return NextResponse.json({ error: "Fidelity OAuth not configured" }, { status: 500 })
      }

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "account_data trading",
        state: stateStr,
      })

      authUrl = `https://api.fidelity.com/oauth/authorize?${params}`
    }

    return NextResponse.json({
      success: true,
      authUrl,
      state: stateStr,
    })
  } catch (err) {
    console.error("[custodian/init] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
