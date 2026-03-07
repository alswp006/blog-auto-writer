import { queryOne, execute } from "@/lib/db";
import { FEATURE_MAP, hasAccess } from "@/config/features";
import type { Tier } from "@/config/features";

export type Subscription = {
  id: number;
  user_id: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  tier: Tier;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export async function getSubscriptionTier(userId: number): Promise<Tier> {
  const sub = await queryOne<Subscription>(
    "SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active'",
    userId
  );
  if (!sub) return "free";
  return sub.tier;
}

export function isPremiumFeature(featureKey: string): boolean {
  const config = FEATURE_MAP[featureKey];
  if (!config) return false;
  return config.requiredTier !== "free";
}

export async function canAccessFeature(userId: number, featureKey: string): Promise<boolean> {
  const config = FEATURE_MAP[featureKey];
  if (!config) return true; // Unknown features are free by default
  const userTier = await getSubscriptionTier(userId);
  return hasAccess(userTier, config.requiredTier);
}

export async function getSubscriptionByUserId(userId: number): Promise<Subscription | undefined> {
  return await queryOne<Subscription>(
    "SELECT * FROM subscriptions WHERE user_id = ?",
    userId
  );
}

export async function getSubscriptionByCustomerId(customerId: string): Promise<Subscription | undefined> {
  return await queryOne<Subscription>(
    "SELECT * FROM subscriptions WHERE stripe_customer_id = ?",
    customerId
  );
}

export async function upsertSubscription(params: {
  userId: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  tier: Tier;
  currentPeriodEnd: string | null;
}): Promise<void> {
  const existing = await getSubscriptionByUserId(params.userId);
  if (existing) {
    await execute(
      `UPDATE subscriptions SET
        stripe_customer_id = ?,
        stripe_subscription_id = ?,
        status = ?,
        tier = ?,
        current_period_end = ?,
        updated_at = datetime('now')
      WHERE user_id = ?`,
      params.stripeCustomerId,
      params.stripeSubscriptionId,
      params.status,
      params.tier,
      params.currentPeriodEnd,
      params.userId
    );
  } else {
    await execute(
      `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, tier, current_period_end)
       VALUES (?, ?, ?, ?, ?, ?)`,
      params.userId,
      params.stripeCustomerId,
      params.stripeSubscriptionId,
      params.status,
      params.tier,
      params.currentPeriodEnd
    );
  }
}

export async function deactivateSubscription(stripeSubscriptionId: string): Promise<void> {
  await execute(
    `UPDATE subscriptions SET status = 'canceled', tier = 'free', updated_at = datetime('now')
     WHERE stripe_subscription_id = ?`,
    stripeSubscriptionId
  );
}
