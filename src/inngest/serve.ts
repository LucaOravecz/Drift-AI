import { serve } from "inngest/next"
import { inngest } from "./client"
import {
  dailyOpportunityScan,
  weeklyComplianceCheck,
  processPendingJobs,
  briefGeneration,
} from "./functions"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    dailyOpportunityScan,
    weeklyComplianceCheck,
    processPendingJobs,
    briefGeneration,
  ],
})
