import { NextResponse } from "next/server";
import { BillingService } from "@/lib/services/billing.service";

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events for subscription management.
 * In production, verify the webhook signature using STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const event = JSON.parse(body);

  // TODO: Verify Stripe webhook signature
  // const sig = request.headers.get("stripe-signature");
  // stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await BillingService.handleCheckoutComplete(event.data.object);
        break;

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
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
