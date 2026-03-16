import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postModel from "@/lib/models/post";
import * as photoModel from "@/lib/models/photo";
import * as placeModel from "@/lib/models/place";
import * as postVariantModel from "@/lib/models/postVariant";
import { optimizeForPlatform } from "@/lib/ai/optimize";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const postId = parseInt(id, 10);
  const post = await postModel.getById(postId);
  if (!post || post.userId !== auth.userId) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const platform = body.platform as "naver" | "tistory" | "medium" | undefined;
  const lang = (body.lang as "ko" | "en") ?? "ko";

  if (!platform || !["naver", "tistory", "medium"].includes(platform)) {
    return NextResponse.json({ error: "platform must be naver, tistory, or medium" }, { status: 400 });
  }

  const title = lang === "en" ? post.titleEn : post.titleKo;
  const content = lang === "en" ? post.contentEn : post.contentKo;
  const hashtags = lang === "en" ? post.hashtagsEn : post.hashtagsKo;

  if (!title || !content) {
    return NextResponse.json({ error: "Post has no content to optimize" }, { status: 400 });
  }

  const place = await placeModel.getById(post.placeId);
  const photos = await photoModel.listPhotos(post.placeId);

  try {
    const result = await optimizeForPlatform({
      platform,
      lang,
      baseTitle: title,
      baseContent: content,
      baseHashtags: hashtags,
      placeName: place?.name ?? "Unknown",
      photoCount: photos.length,
    });

    const variant = await postVariantModel.upsert(
      postId, platform, lang,
      result.title, result.content, result.hashtags,
    );

    return NextResponse.json({ variant });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Optimization failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
