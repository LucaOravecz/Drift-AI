import { Inngest } from "inngest"

export const inngest = new Inngest({
  id: "drift-ai",
  apiKey: process.env.INNGEST_EVENT_KEY,
})
