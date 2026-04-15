import "server-only"
import { NextResponse } from "next/server"
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth"
import { z } from "zod"
import prisma from "@/lib/db"
import { AuditService } from "@/lib/services/audit.service"

const querySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  provider: z.enum(["SCHWAB", "FIDELITY"]).optional(),
})

/**
 * GET /api/v1/integrations/custodian/auth
 *
 * Custodian OAuth callback handler.
 * Schwab and Fidelity redirect here after user authorizes access.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const params = Object.fromEntries(url.searchParams)
    const parsed = querySchema.safeParse(params)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
    }

    const { code, state, error, provider } = parsed.data

    if (error) {
      return NextResponse.json(
        { error: `User denied authorization: ${error}` },
        { status: 400 },
      )
    }

    if (!code || !state) {
      return NextResponse.json({ error: "Missing code or state" }, { status: 400 })
    }

    const redirectUrl = `/settings/integrations?provider=${provider}&code=${code}&state=${state}&success=1`
    return NextResponse.redirect(redirectUrl)
  } catch (err) {
    console.error("[custodian/auth] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/v1/integrations/custodian/auth
 *
 * Exchange OAuth code for tokens and store in IntegrationConfig.
 */
export async function POST(req: Request) {
  const auth = await authenticateApiRequest()
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 })
  }

  if (!hasPermission(auth.context, "write", "custodian_integrations")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { provider, code, state } = body

    if (!provider || !code) {
      return NextResponse.json(
        { error: "Missing provider or authorization code" },
        { status: 400 },
      )
    }

    const organizationId = auth.context!.organizationId
    const userId = auth.context!.userId

    let tokenResponse: any = null

    if (provider === "SCHWAB") {
      tokenResponse = await exchangeSchwabCode(code)
    } else if (provider === "FIDELITY") {
      tokenResponse = await exchangeFidelityCode(code)
    } else {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 })
    }

    if (!tokenResponse) {
      return NextResponse.json(
        { error: "Failed to exchange authorization code" },
        { status: 400 },
      )
    }

    const integration = await prisma.integrationConfig.upsert({
      where: { organizationId_provider: { organizationId, provider } },
      update: {
        config: { ...tokenResponse, authorizedAt: new Date().toISOString() } as any,
        status: "ACTIVE",
        lastError: null,
        errorCount: 0,
      },
      create: {
        organizationId,
        provider,
        category: "CUSTODIAN",
        config: { ...tokenResponse, authorizedAt: new Date().toISOString() } as any,
        status: "ACTIVE",
      },
    })

    await AuditService.logAction({
      organizationId,
      userId,
      action: "INTEGRATION_CONNECTED",
      target: `IntegrationConfig:${integration.id}`,
      details: `Connected to ${provider} Advisor Services for portfolio data sync`,
      metadata: { provider, integrationId: integration.id },
      severity: "INFO",
    })

    return NextResponse.json({
      success: true,
      integration,
      message: `Successfully connected to ${provider}. Portfolio data will sync nightly.`,
    })
  } catch (err) {
    console.error("[custodian/auth] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function exchangeSchwabCode(code: string) {
  const clientId = process.env.SCHWAB_CLIENT_ID
  const clientSecret = process.env.SCHWAB_CLIENT_SECRET
  const redirectUri = process.env.SCHWAB_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Schwab OAuth credentials not configured")
  }

  const response = await fetch("https://login.schwabapi.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("[Schwab OAuth] Failed to exchange code:", error)
    return null
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: new Date(Date.now() + (data.expires_in || 1800) * 1000).toISOString(),
    clientId,
    clientSecret,
  }
}

async function exchangeFidelityCode(code: string) {
  const clientId = process.env.FIDELITY_CLIENT_ID
  const clientSecret = process.env.FIDELITY_CLIENT_SECRET
  const redirectUri = process.env.FIDELITY_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Fidelity OAuth credentials not configured")
  }

  const response = await fetch("https://api.fidelity.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("[Fidelity OAuth] Failed to exchange code:", error)
    return null
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: new Date(Date.now() + (data.expires_in || 1800) * 1000).toISOString(),
    clientId,
    clientSecret,
  }
}
