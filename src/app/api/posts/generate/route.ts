import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postModel from "@/lib/models/post";
import * as placeModel from "@/lib/models/place";
import * as menuItemModel from "@/lib/models/menuItem";
import * as photoModel from "@/lib/models/photo";
import * as styleProfileModel from "@/lib/models/styleProfile";
import * as userProfileModel from "@/lib/models/userProfile";
import { generateBlogPost } from "@/lib/ai/generate";
import * as apiUsageModel from "@/lib/models/apiUsage";

export const maxDuration = 300; // Vercel 서버리스 함수 타임아웃 (초) — Pro: 300s, Hobby: 60s 자동 제한

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { placeId, styleProfileId, memo, isRevisit } = body as {
    placeId?: number;
    styleProfileId?: number;
    memo?: string;
    isRevisit?: boolean;
  };

  if (!placeId || !styleProfileId) {
    return NextResponse.json(
      { error: "placeId and styleProfileId are required" },
      { status: 400 },
    );
  }

  const place = await placeModel.getById(placeId, auth.userId);
  if (!place) {
    return NextResponse.json({ error: "Place not found" }, { status: 404 });
  }

  const style = await styleProfileModel.getById(styleProfileId);
  if (!style) {
    return NextResponse.json({ error: "Style profile not found" }, { status: 404 });
  }

  // Create draft post
  const post = await postModel.create({
    userId: auth.userId,
    placeId,
    styleProfileId,
    isRevisit: !!isRevisit,
  });

  try {
    const menuItems = await menuItemModel.listByPlace(placeId);
    const photos = await photoModel.listPhotos(placeId);
    const userProfile = await userProfileModel.getByUserId(auth.userId);
    const userMemo = typeof memo === "string" ? memo : (place.memo ?? "");

    // generateBlogPost handles quality-based retry internally
    const generated = await generateBlogPost(place, menuItems, photos, style, userProfile, userMemo, !!isRevisit, auth.userId);

    // Record API usage
    if (generated.usage) {
      const cost = apiUsageModel.calculateCost(generated.usage.model, generated.usage.inputTokens, generated.usage.outputTokens);
      await apiUsageModel.recordUsage(auth.userId, generated.usage.model, generated.usage.inputTokens, generated.usage.outputTokens, cost);
    }

    const updated = await postModel.updateGenerated(post.id, generated);
    return NextResponse.json({ post: updated }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Generation failed";
    await postModel.setError(post.id, msg);
    return NextResponse.json({ error: msg, postId: post.id }, { status: 500 });
  }
}
