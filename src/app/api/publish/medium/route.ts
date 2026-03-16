import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postModel from "@/lib/models/post";
import * as photoModel from "@/lib/models/photo";
import * as platformConnectionModel from "@/lib/models/platformConnection";
import { publishToMedium } from "@/lib/publish/medium";
import { recordPublish } from "@/lib/models/publishHistory";
import * as postVariantModel from "@/lib/models/postVariant";
import { loadPhotoBuffers } from "@/lib/publish/photo-embed";

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  // Try DB connection first, then fall back to env vars
  const connection = await platformConnectionModel.getByUserAndPlatform(auth.userId, "medium");
  const integrationToken = connection?.accessToken ?? process.env.MEDIUM_INTEGRATION_TOKEN;

  if (!integrationToken) {
    return NextResponse.json(
      { error: "Medium이 연동되지 않았습니다. 설정 페이지에서 연동해주세요." },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { postId, lang = "en" } = body as { postId?: number; lang?: string };
  if (!postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  const post = await postModel.getById(postId);
  if (!post || post.userId !== auth.userId) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const variant = await postVariantModel.getByPostAndPlatform(postId, "medium", lang as "ko" | "en");
  const title = variant ? variant.title : (lang === "en" ? post.titleEn : post.titleKo);
  const content = variant ? variant.content : (lang === "en" ? post.contentEn : post.contentKo);
  const tags = variant ? variant.hashtags : (lang === "en" ? post.hashtagsEn : post.hashtagsKo);

  if (!title || !content) {
    return NextResponse.json({ error: "Post has no content to publish" }, { status: 400 });
  }

  // Load photos for embedding
  const photos = await photoModel.listPhotos(post.placeId);
  const photoBuffers = await loadPhotoBuffers(photos);

  try {
    const result = await publishToMedium({ integrationToken }, title, content, tags, photoBuffers);
    await recordPublish(postId, "medium", lang as "ko" | "en", result.url);
    return NextResponse.json({ url: result.url, mediumPostId: result.postId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Publish failed";
    await recordPublish(postId, "medium", lang as "ko" | "en", null, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
