import { query, execute } from "@/lib/db";

export type PostVariantRow = {
  id: number;
  post_id: number;
  platform: "naver" | "tistory" | "medium";
  lang: "ko" | "en";
  title: string;
  content: string;
  hashtags_json: string;
  created_at: string;
  updated_at: string;
};

export type PostVariant = {
  id: number;
  postId: number;
  platform: "naver" | "tistory" | "medium";
  lang: "ko" | "en";
  title: string;
  content: string;
  hashtags: string[];
  createdAt: string;
  updatedAt: string;
};

function rowToVariant(row: PostVariantRow): PostVariant {
  return {
    id: row.id,
    postId: row.post_id,
    platform: row.platform,
    lang: row.lang,
    title: row.title,
    content: row.content,
    hashtags: JSON.parse(row.hashtags_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsert(
  postId: number,
  platform: "naver" | "tistory" | "medium",
  lang: "ko" | "en",
  title: string,
  content: string,
  hashtags: string[],
): Promise<PostVariant> {
  const now = new Date().toISOString();
  const hashtagsJson = JSON.stringify(hashtags);

  await execute(
    `INSERT INTO post_variants (post_id, platform, lang, title, content, hashtags_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(post_id, platform, lang)
     DO UPDATE SET title = excluded.title, content = excluded.content, hashtags_json = excluded.hashtags_json, updated_at = excluded.updated_at`,
    postId, platform, lang, title, content, hashtagsJson, now, now,
  );

  const rows = await query<PostVariantRow>(
    "SELECT * FROM post_variants WHERE post_id = ? AND platform = ? AND lang = ?",
    postId, platform, lang,
  );
  return rowToVariant(rows[0]);
}

export async function getByPostAndPlatform(
  postId: number,
  platform: "naver" | "tistory" | "medium",
  lang: "ko" | "en",
): Promise<PostVariant | null> {
  const rows = await query<PostVariantRow>(
    "SELECT * FROM post_variants WHERE post_id = ? AND platform = ? AND lang = ?",
    postId, platform, lang,
  );
  return rows.length > 0 ? rowToVariant(rows[0]) : null;
}

export async function listByPost(postId: number): Promise<PostVariant[]> {
  const rows = await query<PostVariantRow>(
    "SELECT * FROM post_variants WHERE post_id = ? ORDER BY platform, lang",
    postId,
  );
  return rows.map(rowToVariant);
}
