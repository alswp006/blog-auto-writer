import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postAnalytics from "@/lib/models/postAnalytics";

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const topPosts = await postAnalytics.getTopPosts(auth.userId);
  return NextResponse.json({ topPosts });
}

// POST: Fetch latest stats from platforms and save
export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  // Medium Stats API is very limited (no public API for post stats)
  // WordPress - could use REST API to fetch views if Jetpack is installed
  // For now, manual input is the fallback

  const topPosts = await postAnalytics.getTopPosts(auth.userId);
  return NextResponse.json({ updated: 0, topPosts });
}
