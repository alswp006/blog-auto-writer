import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postModel from "@/lib/models/post";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const postId = parseInt(id, 10);
  const post = postModel.getById(postId);
  if (!post || post.userId !== auth.userId) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.status !== "generated") {
    return NextResponse.json({ error: "Only generated posts can be scheduled" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const scheduledAt = body.scheduledAt as string | undefined;
  const platform = body.platform as string | undefined;
  const lang = body.lang as string | undefined;

  if (!scheduledAt || !platform || !lang) {
    return NextResponse.json({ error: "scheduledAt, platform, and lang are required" }, { status: 400 });
  }

  const validPlatforms = ["tistory", "medium", "wordpress", "naver"];
  if (!validPlatforms.includes(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  if (!["ko", "en"].includes(lang)) {
    return NextResponse.json({ error: "Invalid lang" }, { status: 400 });
  }

  // Validate that scheduledAt is in the future
  const scheduleDate = new Date(scheduledAt);
  if (isNaN(scheduleDate.getTime())) {
    return NextResponse.json({ error: "Invalid scheduledAt date" }, { status: 400 });
  }
  if (scheduleDate.getTime() < Date.now()) {
    return NextResponse.json({ error: "scheduledAt must be in the future" }, { status: 400 });
  }

  const updated = postModel.schedule(postId, scheduleDate.toISOString(), platform, lang);
  return NextResponse.json({ post: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const postId = parseInt(id, 10);
  const post = postModel.getById(postId);
  if (!post || post.userId !== auth.userId) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const updated = postModel.unschedule(postId);
  return NextResponse.json({ post: updated });
}
