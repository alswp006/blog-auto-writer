import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postModel from "@/lib/models/post";
import * as placeModel from "@/lib/models/place";
import * as photoModel from "@/lib/models/photo";
import * as publishHistoryModel from "@/lib/models/publishHistory";
import * as postVariantModel from "@/lib/models/postVariant";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const post = await postModel.getById(parseInt(id, 10));
  if (!post || post.userId !== auth.userId) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const place = await placeModel.getById(post.placeId);
  const photos = await photoModel.listPhotos(post.placeId);
  const publishHistory = await publishHistoryModel.getByPostId(post.id);
  const variants = await postVariantModel.listByPost(post.id);

  return NextResponse.json({ post, place, photos, publishHistory, variants });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const postId = parseInt(id, 10);
  const existing = await postModel.getById(postId);
  if (!existing || existing.userId !== auth.userId) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const updated = await postModel.updateContent(postId, {
    titleKo: body.titleKo as string | undefined,
    contentKo: body.contentKo as string | undefined,
    hashtagsKo: body.hashtagsKo as string[] | undefined,
    titleEn: body.titleEn as string | undefined,
    contentEn: body.contentEn as string | undefined,
    hashtagsEn: body.hashtagsEn as string[] | undefined,
  });

  return NextResponse.json({ post: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const postId = parseInt(id, 10);
  const existing = await postModel.getById(postId);
  if (!existing || existing.userId !== auth.userId) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  await postModel.remove(postId);
  return NextResponse.json({ success: true });
}
