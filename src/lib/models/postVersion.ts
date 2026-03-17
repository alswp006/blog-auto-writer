import { query, execute } from "@/lib/db";

export type PostVersion = {
  id: number;
  postId: number;
  titleKo: string | null;
  contentKo: string | null;
  hashtagsKo: string[];
  titleEn: string | null;
  contentEn: string | null;
  hashtagsEn: string[];
  changeReason: string;
  createdAt: string;
};

type PostVersionRow = {
  id: number;
  post_id: number;
  title_ko: string | null;
  content_ko: string | null;
  hashtags_ko_json: string;
  title_en: string | null;
  content_en: string | null;
  hashtags_en_json: string;
  change_reason: string;
  created_at: string;
};

function rowToVersion(row: PostVersionRow): PostVersion {
  return {
    id: row.id,
    postId: row.post_id,
    titleKo: row.title_ko,
    contentKo: row.content_ko,
    hashtagsKo: JSON.parse(row.hashtags_ko_json) as string[],
    titleEn: row.title_en,
    contentEn: row.content_en,
    hashtagsEn: JSON.parse(row.hashtags_en_json) as string[],
    changeReason: row.change_reason,
    createdAt: row.created_at,
  };
}

export async function saveVersion(
  postId: number,
  data: {
    titleKo: string | null;
    contentKo: string | null;
    hashtagsKo: string[];
    titleEn: string | null;
    contentEn: string | null;
    hashtagsEn: string[];
  },
  changeReason: string = "manual_edit",
): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO post_versions (post_id, title_ko, content_ko, hashtags_ko_json, title_en, content_en, hashtags_en_json, change_reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    postId,
    data.titleKo,
    data.contentKo,
    JSON.stringify(data.hashtagsKo),
    data.titleEn,
    data.contentEn,
    JSON.stringify(data.hashtagsEn),
    changeReason,
    now,
  );
}

export async function listByPost(postId: number, limit: number = 20): Promise<PostVersion[]> {
  const rows = await query<PostVersionRow>(
    "SELECT * FROM post_versions WHERE post_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
    postId,
    limit,
  );
  return rows.map(rowToVersion);
}

const MAX_VERSIONS_PER_POST = 20;

export async function pruneOldVersions(postId: number): Promise<void> {
  await execute(
    `DELETE FROM post_versions WHERE post_id = ? AND id NOT IN (
      SELECT id FROM post_versions WHERE post_id = ? ORDER BY created_at DESC, id DESC LIMIT ?
    )`,
    postId,
    postId,
    MAX_VERSIONS_PER_POST,
  );
}
