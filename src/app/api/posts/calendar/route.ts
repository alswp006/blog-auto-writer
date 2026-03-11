import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/auth";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const year = parseInt(url.searchParams.get("year") ?? new Date().getFullYear().toString(), 10);
  const month = parseInt(url.searchParams.get("month") ?? (new Date().getMonth() + 1).toString(), 10);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01T00:00:00.000Z`;

  const rows = await query<{
    id: number;
    title_ko: string | null;
    title_en: string | null;
    status: string;
    created_at: string;
    scheduled_at: string | null;
    scheduled_platform: string | null;
    place_name: string | null;
    place_category: string | null;
    thumbnail_path: string | null;
  }>(
    `SELECT p.id, p.title_ko, p.title_en, p.status, p.created_at,
      p.scheduled_at, p.scheduled_platform,
      pl.name as place_name, pl.category as place_category,
      (SELECT ph.file_path FROM photos ph WHERE ph.place_id = p.place_id ORDER BY ph.order_index ASC LIMIT 1) as thumbnail_path
     FROM posts p
     LEFT JOIN places pl ON pl.id = p.place_id
     WHERE p.user_id = ? AND (
       (p.created_at >= ? AND p.created_at < ?)
       OR (p.scheduled_at >= ? AND p.scheduled_at < ?)
     )
     ORDER BY p.created_at ASC`,
    auth.userId, startDate, endDate, startDate, endDate,
  );

  const publishRows = await query<{
    post_id: number;
    platform: string;
    status: string;
    published_at: string;
  }>(
    `SELECT ph.post_id, ph.platform, ph.status, ph.published_at
     FROM publish_history ph
     INNER JOIN posts p ON p.id = ph.post_id
     WHERE p.user_id = ? AND ph.published_at >= ? AND ph.published_at < ?`,
    auth.userId, startDate, endDate,
  );

  const posts = rows.map((r) => ({
    id: r.id,
    titleKo: r.title_ko,
    titleEn: r.title_en,
    status: r.status,
    createdAt: r.created_at,
    scheduledAt: r.scheduled_at,
    scheduledPlatform: r.scheduled_platform,
    placeName: r.place_name,
    placeCategory: r.place_category,
    thumbnailPath: r.thumbnail_path,
  }));

  const publishes = publishRows.map((r) => ({
    postId: r.post_id,
    platform: r.platform,
    status: r.status,
    publishedAt: r.published_at,
  }));

  return NextResponse.json({ posts, publishes, year, month });
}
