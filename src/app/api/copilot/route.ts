import { NextResponse } from "next/server"
import { runCopilot } from "@/lib/services/copilot.service"
import prisma from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { prompt } = body

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 })
    }

    const org = await prisma.organization.findFirst()
    if (!org) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 })
    }

    const response = await runCopilot(prompt.trim(), org.id)
    return NextResponse.json(response)
  } catch (err) {
    console.error("[CopilotRoute] Error:", err)
    return NextResponse.json({ error: "Copilot request failed" }, { status: 500 })
  }
}
