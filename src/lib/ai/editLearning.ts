import { query } from "@/lib/db";

interface EditPatternRow {
  post_id: number;
  content_ko: string | null;
  change_reason: string;
  created_at: string;
}

/**
 * Get recent edit patterns for a user to include in generation prompt.
 * Compares consecutive versions of the same post to find what the user changed.
 */
export async function getUserEditPatterns(userId: number, limit: number = 5): Promise<string> {
  // Get recent posts by this user that have manual_edit versions
  const rows = await query<EditPatternRow>(
    `SELECT pv.post_id, pv.content_ko, pv.change_reason, pv.created_at
     FROM post_versions pv
     JOIN posts p ON p.id = pv.post_id
     WHERE p.user_id = ? AND pv.change_reason = 'manual_edit' AND pv.content_ko IS NOT NULL
     ORDER BY pv.created_at DESC
     LIMIT ?`,
    userId,
    limit * 2,  // get more to find pairs
  );

  if (rows.length < 2) return "";

  // Compare pairs: the AI-generated version vs the user-edited version
  // post_versions saves the PREVIOUS state before edit, so:
  // - The older version = what AI generated
  // - The newer version (or current post) = what user kept

  // Group by post_id and find diffs
  const postGroups = new Map<number, EditPatternRow[]>();
  for (const row of rows) {
    const group = postGroups.get(row.post_id) ?? [];
    group.push(row);
    postGroups.set(row.post_id, group);
  }

  const patterns: string[] = [];
  for (const [, versions] of postGroups) {
    if (versions.length < 2) continue;
    // versions[0] = newer (what user changed TO), versions[1] = older (what AI wrote)
    const aiVersion = versions[versions.length - 1].content_ko;
    const userVersion = versions[0].content_ko;
    if (!aiVersion || !userVersion) continue;
    if (aiVersion === userVersion) continue;

    // Extract a short summary of what changed (first 150 chars of each)
    patterns.push(`AI가 쓴 것: "${aiVersion.slice(0, 150)}..."\n사용자가 고친 것: "${userVersion.slice(0, 150)}..."`);
    if (patterns.length >= limit) break;
  }

  if (patterns.length === 0) return "";

  return `\n### 이 사용자의 편집 이력 (이 패턴을 학습해서 처음부터 사용자가 원하는 스타일로 쓰세요)
${patterns.map((p, i) => `${i + 1}. ${p}`).join("\n\n")}`;
}
