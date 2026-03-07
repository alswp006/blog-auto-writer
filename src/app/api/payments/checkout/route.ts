import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isStripeConfigured, createCheckoutSession } from "@/lib/stripe";
import { getSubscriptionByUserId } from "@/lib/subscription";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Payments are not configured" },
      { status: 503 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { priceId, mode = "subscription", successUrl, cancelUrl } = body;

  if (!priceId) {
    return NextResponse.json({ error: "priceId is required" }, { status: 400 });
  }

  const existing = getSubscriptionByUserId(user.id);

  const session = await createCheckoutSession({
    priceId,
    mode,
    customerId: existing?.stripe_customer_id || undefined,
    customerEmail: !existing?.stripe_customer_id ? user.email : undefined,
    successUrl,
    cancelUrl,
  });

  if (!session) {
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: session.url });
}
