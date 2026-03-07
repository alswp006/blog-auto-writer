import { NextRequest, NextResponse } from "next/server";
import { isStripeConfigured, constructWebhookEvent } from "@/lib/stripe";
import { upsertSubscription, deactivateSubscription } from "@/lib/subscription";
import { queryOne } from "@/lib/db";
import type { Tier } from "@/config/features";

type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  current_period_end: number;
  items: { data: Array<{ price: { lookup_key?: string; metadata?: Record<string, string> } }> };
  metadata?: Record<string, string>;
};

type StripeCheckoutSession = {
  customer: string;
  customer_email?: string;
  subscription?: string;
  mode: string;
  metadata?: Record<string, string>;
};

function resolveTier(subscription: StripeSubscription): Tier {
  // Check subscription metadata first
  const metaTier = subscription.metadata?.tier;
  if (metaTier === "pro" || metaTier === "enterprise") return metaTier;

  // Check price lookup_key or metadata
  const price = subscription.items?.data?.[0]?.price;
  const priceTier = price?.metadata?.tier || price?.lookup_key;
  if (priceTier === "pro" || priceTier === "enterprise") return priceTier;

  return "pro"; // Default paid subscription to pro
}

function resolveUserId(customerId: string, email?: string): number | null {
  // Try finding by existing subscription
  const sub = queryOne<{ user_id: number }>(
    "SELECT user_id FROM subscriptions WHERE stripe_customer_id = ?",
    customerId
  );
  if (sub) return sub.user_id;

  // Try by email
  if (email) {
    const user = queryOne<{ id: number }>(
      "SELECT id FROM users WHERE email = ?",
      email
    );
    if (user) return user.id;
  }

  return null;
}

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Payments are not configured" },
      { status: 503 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = constructWebhookEvent(body, signature);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!event) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as unknown as StripeCheckoutSession;

      if (session.mode === "subscription" && session.subscription) {
        const userId = resolveUserId(
          session.customer,
          session.customer_email || undefined
        );
        if (userId) {
          // We'll get full subscription details from the subscription.updated event
          // but set up the customer mapping now
          upsertSubscription({
            userId,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            status: "active",
            tier: "pro",
            currentPeriodEnd: null,
          });
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as unknown as StripeSubscription;
      const userId = resolveUserId(subscription.customer);
      if (userId) {
        const tier = resolveTier(subscription);
        const isActive = ["active", "trialing"].includes(subscription.status);
        upsertSubscription({
          userId,
          stripeCustomerId: subscription.customer,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          tier: isActive ? tier : "free",
          currentPeriodEnd: new Date(
            subscription.current_period_end * 1000
          ).toISOString(),
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as unknown as StripeSubscription;
      deactivateSubscription(subscription.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
