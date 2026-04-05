import { query } from "@/lib/db";

interface VersionRow {
  post_id: number;
  content_ko: string | null;
  change_reason: string;
  created_at: string;
}

interface PostContentRow {
  id: number;
  content_ko: string | null;
}

/**
 * Extract meaningful excerpts from before/after versions.
 * Takes 3 slices: intro (first 120 chars), middle, and ending (last 120 chars).
 */
function extractExcerpts(text: string, maxChars: number = 120): string[] {
  const cleaned = text.replace(/\[PHOTO:\d+\]/g, "").trim();
  if (cleaned.length <= maxChars * 2) return [cleaned];

  const mid = Math.floor(cleaned.length / 2);
  return [
    cleaned.slice(0, maxChars).trim(),
    cleaned.slice(mid - Math.floor(maxChars / 2), mid + Math.floor(maxChars / 2)).trim(),
    cleaned.slice(-maxChars).trim(),
  ];
}

/**
 * Get recent edit patterns for a user to include in generation prompt.
 * Compares the AI-generated version (saved in post_versions before edit)
 * with the user's final version (current post content) to show real diffs.
 */
export async function getUserEditPatterns(userId: number, limit: number = 3): Promise<string> {
  // Step 1: Find posts that have manual_edit versions (= user actually edited)
  const editedPosts = await query<{ post_id: number }>(
    `SELECT DISTINCT pv.post_id
     FROM post_versions pv
     JOIN posts p ON p.id = pv.post_id
     WHERE p.user_id = ? AND pv.change_reason = 'manual_edit' AND pv.content_ko IS NOT NULL
     ORDER BY pv.created_at DESC
     LIMIT ?`,
    userId,
    limit,
  );

  if (editedPosts.length === 0) return "";

  const patterns: string[] = [];

  for (const { post_id } of editedPosts) {
    // Get the earliest version (= what AI originally generated)
    const versions = await query<VersionRow>(
      `SELECT content_ko, change_reason, created_at
       FROM post_versions
       WHERE post_id = ? AND content_ko IS NOT NULL
       ORDER BY created_at ASC, id ASC
       LIMIT 1`,
      post_id,
    );

    // Get the current post content (= what user kept after editing)
    const currentPost = await query<PostContentRow>(
      `SELECT id, content_ko FROM posts WHERE id = ?`,
      post_id,
    );

    if (versions.length === 0 || currentPost.length === 0) continue;

    const aiContent = versions[0].content_ko;
    const userContent = currentPost[0].content_ko;
    if (!aiContent || !userContent || aiContent === userContent) continue;

    // Extract excerpts from intro/middle/ending
    const aiExcerpts = extractExcerpts(aiContent);
    const userExcerpts = extractExcerpts(userContent);

    patterns.push(
      `[AI 원본]\n${aiExcerpts.map((e) => `"${e}"`).join("\n...\n")}\n` +
      `[사용자 수정]\n${userExcerpts.map((e) => `"${e}"`).join("\n...\n")}`,
    );
  }

  if (patterns.length === 0) return "";

  return `\n### 이 사용자의 편집 이력 (이 패턴을 학습해서 처음부터 사용자가 원하는 스타일로 쓰세요)
이 사용자는 AI가 생성한 글을 아래처럼 수정했습니다. 어떤 표현을 어떻게 바꿨는지 파악하고, 이번 글은 처음부터 사용자가 원하는 스타일로 작성하세요.

${patterns.map((p, i) => `--- 수정 사례 ${i + 1} ---\n${p}`).join("\n\n")}`;
}
