import "server-only"

import { NextResponse } from "next/server"
import Stripe from "stripe"
import { getActiveSession } from "@/lib/auth"
import { authenticateApiRequest } from "@/lib/middleware/api-auth"
import { BillingService, type PlanTier } from "@/lib/services/billing.service"

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY ?? "")

export async function POST() {
  const auth = await authenticateApiRequest()
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 })
  }

  try {
    const session = await getActiveSession()
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const subscription = await BillingService.getSubscription(session.user.organizationId)
    if (!subscription.stripeCustomerId) {
      return NextResponse.json({ error: "No Stripe customer found. Subscribe first." }, { status: 400 })
    }

    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/settings`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    console.error("[StripePortal] Error:", err)
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 })
  }
}
