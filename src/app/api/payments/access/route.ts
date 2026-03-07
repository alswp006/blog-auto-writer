import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/stripe";
import { canAccessFeature } from "@/lib/subscription";

export async function GET(request: NextRequest) {
  const feature = request.nextUrl.searchParams.get("feature");

  // If Stripe is not configured, all features are accessible
  if (!isStripeConfigured()) {
    return NextResponse.json({ hasAccess: true });
  }

  if (!feature) {
    return NextResponse.json({ hasAccess: true });
  }

  const user = await getCurrentUser();
  if (!user) {
    // Not logged in — show free-tier access
    return NextResponse.json({ hasAccess: false });
  }

  const hasAccess = canAccessFeature(user.id, feature);
  return NextResponse.json({ hasAccess });
}
