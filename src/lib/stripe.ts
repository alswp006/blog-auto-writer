import type Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  // Dynamic require to avoid module-level import
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const StripeLib = require("stripe").default as typeof import("stripe").default;
  _stripe = new StripeLib(key);
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export async function createCheckoutSession(params: {
  priceId: string;
  mode: "subscription" | "payment";
  customerId?: string;
  customerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<Stripe.Checkout.Session | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return stripe.checkout.sessions.create({
    mode: params.mode,
    line_items: [{ price: params.priceId, quantity: 1 }],
    ...(params.customerId ? { customer: params.customerId } : {}),
    ...(params.customerEmail && !params.customerId
      ? { customer_email: params.customerEmail }
      : {}),
    success_url: params.successUrl || `${baseUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: params.cancelUrl || `${baseUrl}/pricing`,
  });
}

export async function createPortalSession(params: {
  customerId: string;
  returnUrl?: string;
}): Promise<Stripe.BillingPortal.Session | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl || `${baseUrl}/dashboard`,
  });
}

export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  return stripe.subscriptions.retrieve(subscriptionId);
}

export function constructWebhookEvent(
  body: string | Buffer,
  signature: string
): Stripe.Event | null {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return null;

  return stripe.webhooks.constructEvent(body, signature, secret);
}
