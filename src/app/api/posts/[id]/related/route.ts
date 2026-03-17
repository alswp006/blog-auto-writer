import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import * as postModel from "@/lib/models/post";
import { query, queryOne } from "@/lib/db";

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

  const place = await queryOne<{ name: string; category: string; address: string | null }>(
    "SELECT name, category, address FROM places WHERE id = ?",
    post.placeId,
  );
  if (!place) {
    return NextResponse.json({ related: [] });
  }

  // Find related posts: same category by same user, excluding current post
  // Priority: same address area (district) > same category
  const addressDistrict = place.address?.match(/([가-힣]+[시군구])\s*([가-힣]+[구동읍면])?/)?.[0] ?? "";

  type RelatedRow = {
    id: number;
    title_ko: string | null;
    title_en: string | null;
    place_name: string;
    place_category: string;
    place_address: string | null;
    status: string;
    created_at: string;
  };

  const rows = await query<RelatedRow>(
    `SELECT p.id, p.title_ko, p.title_en, pl.name as place_name, pl.category as place_category, pl.address as place_address, p.status, p.created_at
     FROM posts p
     JOIN places pl ON pl.id = p.place_id
     WHERE p.user_id = ? AND p.id != ? AND p.status = 'generated'
       AND pl.category = ?
     ORDER BY p.created_at DESC
     LIMIT 10`,
    auth.userId,
    postId,
    place.category,
  );

  // Score and sort by relevance
  const scored = rows.map((r) => {
    let score = 1; // base: same category
    if (addressDistrict && r.place_address?.includes(addressDistrict)) {
      score += 3; // same district
    }
    return {
      id: r.id,
      titleKo: r.title_ko,
      titleEn: r.title_en,
      placeName: r.place_name,
      placeCategory: r.place_category,
      placeAddress: r.place_address,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return NextResponse.json({ related: scored.slice(0, 5) });
}
