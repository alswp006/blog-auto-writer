import { query, queryOne, execute } from "@/lib/db";

export type PostAnalyticsRow = {
  id: number;
  post_id: number;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  fetched_at: string;
};

export type PostAnalytics = {
  id: number;
  postId: number;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  fetchedAt: string;
};

function rowToAnalytics(row: PostAnalyticsRow): PostAnalytics {
  return {
    id: row.id,
    postId: row.post_id,
    platform: row.platform,
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    fetchedAt: row.fetched_at,
  };
}

export async function upsert(
  postId: number,
  platform: string,
  data: { views: number; likes: number; comments: number },
): Promise<PostAnalytics> {
  const now = new Date().toISOString();

  // Check existing
  const existing = await queryOne<PostAnalyticsRow>(
    "SELECT * FROM post_analytics WHERE post_id = ? AND platform = ? ORDER BY fetched_at DESC LIMIT 1",
    postId,
    platform,
  );

  if (existing) {
    await execute(
      "UPDATE post_analytics SET views = ?, likes = ?, comments = ?, fetched_at = ? WHERE id = ?",
      data.views,
      data.likes,
      data.comments,
      now,
      existing.id,
    );
    const updated = await queryOne<PostAnalyticsRow>("SELECT * FROM post_analytics WHERE id = ?", existing.id);
    return rowToAnalytics(updated!);
  }

  const result = await execute(
    "INSERT INTO post_analytics (post_id, platform, views, likes, comments, fetched_at) VALUES (?, ?, ?, ?, ?, ?)",
    postId,
    platform,
    data.views,
    data.likes,
    data.comments,
    now,
  );
  const row = await queryOne<PostAnalyticsRow>("SELECT * FROM post_analytics WHERE id = ?", result.lastInsertRowid);
  return rowToAnalytics(row!);
}

export async function getLatestByPost(postId: number): Promise<PostAnalytics[]> {
  return (await query<PostAnalyticsRow>(
    `SELECT pa.* FROM post_analytics pa
     INNER JOIN (
       SELECT post_id, platform, MAX(fetched_at) as max_fetched
       FROM post_analytics
       WHERE post_id = ?
       GROUP BY post_id, platform
     ) latest ON pa.post_id = latest.post_id AND pa.platform = latest.platform AND pa.fetched_at = latest.max_fetched`,
    postId,
  )).map(rowToAnalytics);
}

export type TopPost = {
  postId: number;
  titleKo: string | null;
  placeName: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  fetchedAt: string;
};

export async function getTopPosts(userId: number, limit = 10): Promise<TopPost[]> {
  return (await query<{
    post_id: number;
    title_ko: string | null;
    place_name: string;
    platform: string;
    views: number;
    likes: number;
    comments: number;
    fetched_at: string;
  }>(
    `SELECT pa.post_id, p.title_ko, pl.name as place_name, pa.platform, pa.views, pa.likes, pa.comments, pa.fetched_at
     FROM post_analytics pa
     JOIN posts p ON p.id = pa.post_id
     LEFT JOIN places pl ON pl.id = p.place_id
     WHERE p.user_id = ?
     ORDER BY pa.views DESC, pa.likes DESC
     LIMIT ?`,
    userId,
    limit,
  )).map((row) => ({
    postId: row.post_id,
    titleKo: row.title_ko,
    placeName: row.place_name ?? "",
    platform: row.platform,
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    fetchedAt: row.fetched_at,
  }));
}
