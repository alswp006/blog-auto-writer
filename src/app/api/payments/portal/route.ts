import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isStripeConfigured, createPortalSession } from "@/lib/stripe";
import { getSubscriptionByUserId } from "@/lib/subscription";

export async function POST() {
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

  const subscription = getSubscriptionByUserId(user.id);
  if (!subscription?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account found" },
      { status: 404 }
    );
  }

  const session = await createPortalSession({
    customerId: subscription.stripe_customer_id,
  });

  if (!session) {
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: session.url });
}
