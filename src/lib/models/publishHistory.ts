import { query, execute } from "@/lib/db";

export type PublishHistoryRow = {
  id: number;
  post_id: number;
  platform: "tistory" | "medium" | "wordpress" | "naver";
  lang: "ko" | "en";
  published_url: string | null;
  status: "published" | "failed" | "copied";
  error: string | null;
  published_at: string;
};

export type PublishHistory = {
  id: number;
  postId: number;
  platform: "tistory" | "medium" | "wordpress" | "naver";
  lang: "ko" | "en";
  publishedUrl: string | null;
  status: "published" | "failed" | "copied";
  error: string | null;
  publishedAt: string;
};

function rowToPublishHistory(row: PublishHistoryRow): PublishHistory {
  return {
    id: row.id,
    postId: row.post_id,
    platform: row.platform,
    lang: row.lang,
    publishedUrl: row.published_url,
    status: row.status,
    error: row.error,
    publishedAt: row.published_at,
  };
}

export async function recordPublish(
  postId: number,
  platform: "tistory" | "medium" | "wordpress" | "naver",
  lang: "ko" | "en",
  url?: string | null,
  error?: string | null,
): Promise<PublishHistory> {
  const now = new Date().toISOString();
  const status = error ? "failed" : platform === "naver" ? "copied" : "published";

  const result = await execute(
    `INSERT INTO publish_history (post_id, platform, lang, published_url, status, error, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    postId,
    platform,
    lang,
    url ?? null,
    error ?? null,
    now,
  );

  const rows = await query<PublishHistoryRow>(
    "SELECT * FROM publish_history WHERE id = ?",
    result.lastInsertRowid,
  );
  return rowToPublishHistory(rows[0]);
}

export async function getByPostId(postId: number): Promise<PublishHistory[]> {
  return (await query<PublishHistoryRow>(
    "SELECT * FROM publish_history WHERE post_id = ? ORDER BY published_at DESC",
    postId,
  )).map(rowToPublishHistory);
}

export async function getLatestByPost(postId: number): Promise<Map<string, PublishHistory>> {
  const rows = await query<PublishHistoryRow>(
    `SELECT * FROM publish_history
     WHERE id IN (
       SELECT MAX(id) FROM publish_history WHERE post_id = ? AND status != 'failed' GROUP BY platform
     )`,
    postId,
  );
  const map = new Map<string, PublishHistory>();
  for (const row of rows) {
    map.set(row.platform, rowToPublishHistory(row));
  }
  return map;
}

export async function getPublishedPlatformsByPostIds(postIds: number[]): Promise<Map<number, string[]>> {
  if (postIds.length === 0) return new Map();
  const placeholders = postIds.map(() => "?").join(",");
  const rows = await query<{ post_id: number; platform: string }>(
    `SELECT DISTINCT post_id, platform FROM publish_history
     WHERE post_id IN (${placeholders}) AND status != 'failed'`,
    ...postIds,
  );
  const map = new Map<number, string[]>();
  for (const row of rows) {
    const existing = map.get(row.post_id) ?? [];
    existing.push(row.platform);
    map.set(row.post_id, existing);
  }
  return map;
}
