import "server-only"

import { NextResponse } from "next/server"
import Stripe from "stripe"
import { getActiveSession } from "@/lib/auth"
import { authenticateApiRequest } from "@/lib/middleware/api-auth"
import { BillingService, PLAN_LIMITS, type PlanTier } from "@/lib/services/billing.service"

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY ?? "")

const PLAN_PRICES: Record<PlanTier, string | null> = {
  STARTER: null, // Free / trial — no Stripe checkout needed
  PROFESSIONAL: process.env.STRIPE_PROFESSIONAL_PRICE_ID ?? null,
  ENTERPRISE: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? null,
}

export async function POST(request: Request) {
  const auth = await authenticateApiRequest()
  if (!auth.authenticated || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode ?? 401 })
  }

  try {
    const session = await getActiveSession()
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const plan = (body.plan as PlanTier) ?? "PROFESSIONAL"

    if (plan === "STARTER") {
      return NextResponse.json({ error: "Starter plan does not require checkout" }, { status: 400 })
    }

    const priceId = PLAN_PRICES[plan]
    if (!priceId) {
      return NextResponse.json({ error: `No Stripe price configured for ${plan} plan. Set STRIPE_${plan.toUpperCase()}_PRICE_ID.` }, { status: 500 })
    }

    const subscription = await BillingService.getSubscription(session.user.organizationId)

    // Create or reuse Stripe customer
    let customerId = subscription.stripeCustomerId
    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: session.user.email,
        name: session.user.name ?? undefined,
        metadata: { organizationId: session.user.organizationId },
      })
      customerId = customer.id

      await BillingService.updatePlan(session.user.organizationId, subscription.plan as PlanTier, {
        stripeCustomerId: customerId,
      })
    }

    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/settings?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/settings?checkout=canceled`,
      metadata: {
        organizationId: session.user.organizationId,
        plan,
      },
      subscription_data: {
        metadata: {
          organizationId: session.user.organizationId,
          plan,
        },
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err) {
    console.error("[StripeCheckout] Error:", err)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}
