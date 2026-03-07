import { query, queryOne, execute } from "@/lib/db";

export type PostRow = {
  id: number;
  user_id: number;
  place_id: number;
  style_profile_id: number;
  title_ko: string | null;
  content_ko: string | null;
  hashtags_ko_json: string;
  title_en: string | null;
  content_en: string | null;
  hashtags_en_json: string;
  status: "draft" | "generated";
  generation_error: string | null;
  scheduled_at: string | null;
  scheduled_platform: string | null;
  scheduled_lang: string | null;
  is_revisit: 0 | 1;
  created_at: string;
  updated_at: string;
};

export type Post = {
  id: number;
  userId: number;
  placeId: number;
  styleProfileId: number;
  titleKo: string | null;
  contentKo: string | null;
  hashtagsKo: string[];
  titleEn: string | null;
  contentEn: string | null;
  hashtagsEn: string[];
  status: "draft" | "generated";
  generationError: string | null;
  scheduledAt: string | null;
  scheduledPlatform: string | null;
  scheduledLang: string | null;
  isRevisit: boolean;
  createdAt: string;
  updatedAt: string;
};

function rowToPost(row: PostRow): Post {
  return {
    id: row.id,
    userId: row.user_id,
    placeId: row.place_id,
    styleProfileId: row.style_profile_id,
    titleKo: row.title_ko,
    contentKo: row.content_ko,
    hashtagsKo: JSON.parse(row.hashtags_ko_json) as string[],
    titleEn: row.title_en,
    contentEn: row.content_en,
    hashtagsEn: JSON.parse(row.hashtags_en_json) as string[],
    status: row.status,
    generationError: row.generation_error,
    scheduledAt: row.scheduled_at,
    scheduledPlatform: row.scheduled_platform,
    scheduledLang: row.scheduled_lang,
    isRevisit: row.is_revisit === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CreatePostInput = {
  userId: number;
  placeId: number;
  styleProfileId: number;
  isRevisit?: boolean;
};

export async function create(input: CreatePostInput): Promise<Post> {
  const now = new Date().toISOString();
  const result = await execute(
    `INSERT INTO posts (user_id, place_id, style_profile_id, status, is_revisit, hashtags_ko_json, hashtags_en_json, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, '[]', '[]', ?, ?)`,
    input.userId,
    input.placeId,
    input.styleProfileId,
    input.isRevisit ? 1 : 0,
    now,
    now,
  );
  const row = await queryOne<PostRow>("SELECT * FROM posts WHERE id = ?", result.lastInsertRowid);
  if (!row) throw new Error("Failed to create post");
  return rowToPost(row);
}

export async function getById(id: number): Promise<Post | null> {
  const row = await queryOne<PostRow>("SELECT * FROM posts WHERE id = ?", id);
  return row ? rowToPost(row) : null;
}

export async function listByUser(userId: number): Promise<Post[]> {
  return (await query<PostRow>(
    "SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC, rowid DESC",
    userId,
  )).map(rowToPost);
}

export async function updateGenerated(
  id: number,
  data: {
    titleKo: string;
    contentKo: string;
    hashtagsKo: string[];
    titleEn: string;
    contentEn: string;
    hashtagsEn: string[];
  },
): Promise<Post | null> {
  const now = new Date().toISOString();
  await execute(
    `UPDATE posts SET title_ko = ?, content_ko = ?, hashtags_ko_json = ?,
     title_en = ?, content_en = ?, hashtags_en_json = ?,
     status = 'generated', generation_error = NULL, updated_at = ?
     WHERE id = ?`,
    data.titleKo,
    data.contentKo,
    JSON.stringify(data.hashtagsKo),
    data.titleEn,
    data.contentEn,
    JSON.stringify(data.hashtagsEn),
    now,
    id,
  );
  return await getById(id);
}

export async function updateContent(
  id: number,
  data: {
    titleKo?: string;
    contentKo?: string;
    hashtagsKo?: string[];
    titleEn?: string;
    contentEn?: string;
    hashtagsEn?: string[];
  },
): Promise<Post | null> {
  const existing = await queryOne<PostRow>("SELECT * FROM posts WHERE id = ?", id);
  if (!existing) return null;

  const now = new Date().toISOString();
  await execute(
    `UPDATE posts SET title_ko = ?, content_ko = ?, hashtags_ko_json = ?,
     title_en = ?, content_en = ?, hashtags_en_json = ?, updated_at = ?
     WHERE id = ?`,
    data.titleKo ?? existing.title_ko,
    data.contentKo ?? existing.content_ko,
    data.hashtagsKo ? JSON.stringify(data.hashtagsKo) : existing.hashtags_ko_json,
    data.titleEn ?? existing.title_en,
    data.contentEn ?? existing.content_en,
    data.hashtagsEn ? JSON.stringify(data.hashtagsEn) : existing.hashtags_en_json,
    now,
    id,
  );
  return await getById(id);
}

export async function setError(id: number, error: string): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    "UPDATE posts SET generation_error = ?, updated_at = ? WHERE id = ?",
    error,
    now,
    id,
  );
}

export async function schedule(
  id: number,
  scheduledAt: string,
  platform: string,
  lang: string,
): Promise<Post | null> {
  const now = new Date().toISOString();
  await execute(
    `UPDATE posts SET scheduled_at = ?, scheduled_platform = ?, scheduled_lang = ?, updated_at = ? WHERE id = ?`,
    scheduledAt,
    platform,
    lang,
    now,
    id,
  );
  return await getById(id);
}

export async function unschedule(id: number): Promise<Post | null> {
  const now = new Date().toISOString();
  await execute(
    `UPDATE posts SET scheduled_at = NULL, scheduled_platform = NULL, scheduled_lang = NULL, updated_at = ? WHERE id = ?`,
    now,
    id,
  );
  return await getById(id);
}

export async function listDueForPublish(): Promise<Post[]> {
  const now = new Date().toISOString();
  return (await query<PostRow>(
    `SELECT * FROM posts
     WHERE scheduled_at IS NOT NULL
       AND scheduled_at <= ?
       AND status = 'generated'
     ORDER BY scheduled_at ASC`,
    now,
  )).map(rowToPost);
}

export async function remove(id: number): Promise<boolean> {
  const result = await execute("DELETE FROM posts WHERE id = ?", id);
  return result.changes > 0;
}

export type PostWithMeta = Post & {
  placeName: string;
  placeCategory: string;
  thumbnailPath: string | null;
};

export async function listByUserWithMeta(userId: number): Promise<PostWithMeta[]> {
  const rows = await query<PostRow & { place_name: string; place_category: string; thumbnail_path: string | null }>(
    `SELECT p.*, pl.name as place_name, pl.category as place_category,
     (SELECT ph.file_path FROM photos ph WHERE ph.place_id = p.place_id ORDER BY ph.order_index ASC LIMIT 1) as thumbnail_path
     FROM posts p
     LEFT JOIN places pl ON pl.id = p.place_id
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC, p.rowid DESC`,
    userId,
  );
  return rows.map((row) => ({
    ...rowToPost(row),
    placeName: row.place_name ?? "",
    placeCategory: row.place_category ?? "",
    thumbnailPath: row.thumbnail_path ?? null,
  }));
}

export async function countByUserThisMonth(userId: number): Promise<number> {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const result = await queryOne<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM posts WHERE user_id = ? AND created_at >= ?",
    userId,
    firstDay,
  );
  return result?.cnt ?? 0;
}
