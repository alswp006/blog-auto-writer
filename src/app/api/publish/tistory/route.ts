import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postModel from "@/lib/models/post";
import * as platformConnectionModel from "@/lib/models/platformConnection";
import { publishToTistory } from "@/lib/publish/tistory";
import { recordPublish } from "@/lib/models/publishHistory";

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  // Try DB connection first, then fall back to env vars
  const connection = await platformConnectionModel.getByUserAndPlatform(auth.userId, "tistory");
  const accessToken = connection?.accessToken ?? process.env.TISTORY_ACCESS_TOKEN;
  const blogName = connection?.blogName ?? process.env.TISTORY_BLOG_NAME;

  if (!accessToken || !blogName) {
    return NextResponse.json(
      { error: "티스토리가 연동되지 않았습니다. 설정 페이지에서 연동해주세요." },
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
    const result = await publishToTistory({ accessToken, blogName }, title, content, tags);
    await recordPublish(postId, "tistory", lang as "ko" | "en", result.url);
    return NextResponse.json({ url: result.url, tistoryPostId: result.postId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Publish failed";
    await recordPublish(postId, "tistory", lang as "ko" | "en", null, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
