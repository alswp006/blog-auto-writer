import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postModel from "@/lib/models/post";
import { recordPublish } from "@/lib/models/publishHistory";

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

  const platform = (body.platform as string) ?? "naver";
  const lang = (body.lang as string) ?? "ko";

  const entry = await recordPublish(
    postId,
    platform as "naver" | "tistory" | "medium" | "wordpress",
    lang as "ko" | "en",
  );

  return NextResponse.json({ entry });
}
