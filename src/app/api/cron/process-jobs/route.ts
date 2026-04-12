import { NextResponse } from "next/server";
import { BackgroundJobService } from "@/lib/services/background-jobs.service";

/**
 * POST /api/cron/process-jobs
 *
 * Cron endpoint to process pending background jobs.
 * Call this from an external scheduler (Vercel Cron, GitHub Actions, etc.)
 * or use Inngest/Temporal for production.
 *
 * Security: Protected by CRON_SECRET environment variable.
 */
export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const organizationId = body.organizationId as string | undefined;

  let result;

  if (organizationId) {
    // Process jobs for a specific org
    result = await BackgroundJobService.processPendingJobs(organizationId);
  } else {
    // Process all scheduled job types
    const [opportunities, briefs] = await Promise.all([
      BackgroundJobService.scheduleDailyOpportunityScan(),
      organizationId
        ? BackgroundJobService.scheduleUpcomingBriefs(organizationId)
        : Promise.resolve({ scheduled: 0 }),
    ]);

    result = { opportunityScans: opportunities, briefGenerations: briefs };
  }

  return NextResponse.json({ success: true, result });
}
