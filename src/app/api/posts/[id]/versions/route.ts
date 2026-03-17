import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postModel from "@/lib/models/post";
import * as postVersionModel from "@/lib/models/postVersion";

export async function GET(
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

  const versions = await postVersionModel.listByPost(postId);
  return NextResponse.json({ versions });
}

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

  const body = await request.json().catch(() => ({}));
  const versionId = body.versionId as number | undefined;

  if (!versionId) {
    return NextResponse.json({ error: "versionId is required" }, { status: 400 });
  }

  // Find the version to restore
  const versions = await postVersionModel.listByPost(postId, 100);
  const target = versions.find((v) => v.id === versionId);
  if (!target) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Save current state as a version before restoring
  await postVersionModel.saveVersion(postId, {
    titleKo: post.titleKo,
    contentKo: post.contentKo,
    hashtagsKo: post.hashtagsKo,
    titleEn: post.titleEn,
    contentEn: post.contentEn,
    hashtagsEn: post.hashtagsEn,
  }, "before_restore");

  // Restore the target version
  const updated = await postModel.updateContent(postId, {
    titleKo: target.titleKo ?? undefined,
    contentKo: target.contentKo ?? undefined,
    hashtagsKo: target.hashtagsKo,
    titleEn: target.titleEn ?? undefined,
    contentEn: target.contentEn ?? undefined,
    hashtagsEn: target.hashtagsEn,
  });

  return NextResponse.json({ post: updated });
}
