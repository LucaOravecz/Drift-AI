import { inngest } from "./client"
import { BackgroundJobService } from "@/lib/services/background-jobs.service"
import prisma from "@/lib/db"

export const dailyOpportunityScan = inngest.createFunction(
  {
    id: "daily-opportunity-scan",
    name: "Daily Opportunity Scan",
    retries: 2,
    triggers: [{ cron: "0 6 * * *" }],
  },
  async ({ step }) => {
    return await step.run("scan-opportunities", async () => {
      return BackgroundJobService.scheduleDailyOpportunityScan()
    })
  },
)

export const weeklyComplianceCheck = inngest.createFunction(
  {
    id: "weekly-compliance-check",
    name: "Weekly Compliance Check",
    retries: 2,
    triggers: [{ cron: "0 8 * * 1" }],
  },
  async ({ step }) => {
    return await step.run("run-compliance", async () => {
      return BackgroundJobService.scheduleWeeklyComplianceCheck()
    })
  },
)

export const processPendingJobs = inngest.createFunction(
  {
    id: "process-pending-jobs",
    name: "Process Pending Background Jobs",
    retries: 1,
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async ({ step }) => {
    return await step.run("process-jobs", async () => {
      const orgs = await prisma.organization.findMany({
        where: { deletedAt: null },
        select: { id: true },
      })
      const results = []
      for (const org of orgs) {
        results.push(await BackgroundJobService.processPendingJobs(org.id))
      }
      return results
    })
  },
)

export const briefGeneration = inngest.createFunction(
  {
    id: "brief-generation",
    name: "Generate Meeting Briefs",
    retries: 2,
    triggers: [{ event: "drift/brief.generate" }],
  },
  async ({ event, step }) => {
    return await step.run("generate-brief", async () => {
      return BackgroundJobService.scheduleUpcomingBriefs(event.data.organizationId as string)
    })
  },
)
