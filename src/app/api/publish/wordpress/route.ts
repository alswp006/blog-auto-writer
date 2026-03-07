import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postModel from "@/lib/models/post";
import { publishToWordPress, getWordPressConfig } from "@/lib/publish/wordpress";
import { recordPublish } from "@/lib/models/publishHistory";

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const config = getWordPressConfig();
  if (!config) {
    return NextResponse.json(
      { error: "WordPress가 설정되지 않았습니다. 환경변수(WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD)를 확인해주세요." },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { postId, lang = "ko" } = body as { postId?: number; lang?: string };
  if (!postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  const post = await postModel.getById(postId);
  if (!post || post.userId !== auth.userId) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const title = lang === "en" ? post.titleEn : post.titleKo;
  const content = lang === "en" ? post.contentEn : post.contentKo;
  const tags = lang === "en" ? post.hashtagsEn : post.hashtagsKo;

  if (!title || !content) {
    return NextResponse.json({ error: "Post has no content to publish" }, { status: 400 });
  }

  try {
    const result = await publishToWordPress(config, title, content, tags);
    await recordPublish(postId, "wordpress", lang as "ko" | "en", result.url);
    return NextResponse.json({ url: result.url, wordpressPostId: result.postId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Publish failed";
    await recordPublish(postId, "wordpress", lang as "ko" | "en", null, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
