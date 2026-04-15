import "server-only"
import { NextResponse } from "next/server"
import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth"
import prisma from "@/lib/db"

/**
 * GET /api/v1/integrations/custodian/status
 *
 * Get the status of all custodian integrations for this organization.
 */
export async function GET(req: Request) {
  const auth = await authenticateApiRequest()
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 })
  }

  if (!hasPermission(auth.context, "read", "custodian_integrations")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  try {
    const organizationId = auth.context.organizationId

    const integrations = await prisma.integrationConfig.findMany({
      where: {
        organizationId,
        category: "CUSTODIAN",
      },
      select: {
        id: true,
        provider: true,
        status: true,
        lastSyncAt: true,
        lastError: true,
        errorCount: true,
        syncIntervalMinutes: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const accountsPerCustodian = await Promise.all(
      integrations.map(async (int) => ({
        provider: int.provider,
        accountCount: await prisma.financialAccount.count({
          where: {
            custodian: int.provider,
            client: { organizationId },
          },
        }),
      })),
    )

    const status = integrations.map((int) => ({
      ...int,
      accountCount: accountsPerCustodian.find((a) => a.provider === int.provider)?.accountCount || 0,
      nextSyncAt: int.lastSyncAt
        ? new Date(int.lastSyncAt.getTime() + int.syncIntervalMinutes * 60 * 1000)
        : new Date(),
    }))

    return NextResponse.json({
      success: true,
      integrations: status,
      summary: {
        totalIntegrations: integrations.length,
        activeIntegrations: integrations.filter((i) => i.status === "ACTIVE").length,
        totalAccounts: accountsPerCustodian.reduce((sum, a) => sum + a.accountCount, 0),
      },
    })
  } catch (err) {
    console.error("[custodian/status] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
