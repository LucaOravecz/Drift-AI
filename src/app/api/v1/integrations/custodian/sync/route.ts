import "server-only"
import { NextResponse } from "next/server"
import { authenticateApiRequest } from "@/lib/middleware/api-auth"
import { CustodianIntegrationService } from "@/lib/services/custodian-integration.service"
import { AuditService } from "@/lib/services/audit.service"

/**
 * POST /api/v1/integrations/custodian/sync
 *
 * Manually trigger a custodian data sync for the organization.
 */
export async function POST(req: Request) {
  const auth = await authenticateApiRequest()
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 })
  }

  try {
    const organizationId = auth.context!.organizationId
    const userId = auth.context!.userId

    const results = await CustodianIntegrationService.syncAllPositions(organizationId)

    await AuditService.logAction({
      organizationId,
      userId,
      action: "CUSTODIAN_SYNC_EXECUTED",
      target: "CustodianIntegration",
      details: `Manual custodian data sync executed: ${results.reduce((sum, r) => sum + r.positionsUpdated, 0)} positions updated`,
      metadata: {
        results,
        totalPositionsUpdated: results.reduce((sum, r) => sum + r.positionsUpdated, 0),
        totalTransactionsDownloaded: results.reduce((sum, r) => sum + r.transactionsDownloaded, 0),
        errors: results.flatMap(r => r.errors),
      },
      severity: "INFO",
    })

    return NextResponse.json({
      success: true,
      results,
      summary: {
        custodiansSynced: results.length,
        totalPositionsUpdated: results.reduce((sum, r) => sum + r.positionsUpdated, 0),
        totalTransactionsDownloaded: results.reduce((sum, r) => sum + r.transactionsDownloaded, 0),
        totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      },
    })
  } catch (err) {
    console.error("[custodian/sync] error:", err)
    return NextResponse.json({ error: "Failed to sync custodian data" }, { status: 500 })
  }
}
