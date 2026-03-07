export type Tier = "free" | "pro" | "enterprise";

export type FeatureConfig = {
  requiredTier: Tier;
};

export const FEATURE_MAP: Record<string, FeatureConfig> = {
  // Default: all features are free until configured
  // Example:
  // "advanced-export": { requiredTier: "pro" },
  // "api-access": { requiredTier: "enterprise" },
};

const TIER_RANK: Record<Tier, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

export function hasAccess(userTier: Tier, requiredTier: Tier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}
