import "server-only";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { BillingService } from "@/lib/services/billing.service";

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events for subscription management.
 * Verifies the webhook signature using STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  if (webhookSecret && sig) {
    // Production: verify signature
    try {
      event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error("Stripe webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else {
    // Dev mode: parse without verification (webhook secret not configured)
    if (process.env.NODE_ENV === "production") {
      console.error("STRIPE_WEBHOOK_SECRET not set in production — rejecting webhook");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }
    event = JSON.parse(body);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await BillingService.handleCheckoutComplete({
          customer: (session.customer as string) ?? "",
          subscription: (session.subscription as string) ?? "",
          client_reference_id: session.client_reference_id ?? undefined,
          metadata: session.metadata ?? undefined,
        });
        break;
      }

      case "customer.subscription.deleted":
        await BillingService.handleSubscriptionDeleted(event.data.object.id);
        break;

      case "invoice.payment_failed":
        // Mark subscription as past_due
        break;

      case "customer.subscription.updated":
        // Sync seat count, plan changes
        break;

      default:
        // Ignore unhandled events without emitting noisy production logs.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
