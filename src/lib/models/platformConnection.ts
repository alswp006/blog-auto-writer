import { query, queryOne, execute } from "@/lib/db";

export type PlatformConnectionRow = {
  id: number;
  user_id: number;
  platform: "tistory" | "medium";
  access_token: string;
  blog_name: string | null;
  platform_user_id: string | null;
  platform_username: string | null;
  connected_at: string;
  updated_at: string;
};

export type PlatformConnection = {
  id: number;
  userId: number;
  platform: "tistory" | "medium";
  accessToken: string;
  blogName: string | null;
  platformUserId: string | null;
  platformUsername: string | null;
  connectedAt: string;
  updatedAt: string;
};

function rowToConnection(row: PlatformConnectionRow): PlatformConnection {
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform,
    accessToken: row.access_token,
    blogName: row.blog_name,
    platformUserId: row.platform_user_id,
    platformUsername: row.platform_username,
    connectedAt: row.connected_at,
    updatedAt: row.updated_at,
  };
}

export function getByUserAndPlatform(
  userId: number,
  platform: "tistory" | "medium",
): PlatformConnection | null {
  const row = queryOne<PlatformConnectionRow>(
    "SELECT * FROM platform_connections WHERE user_id = ? AND platform = ?",
    userId,
    platform,
  );
  return row ? rowToConnection(row) : null;
}

export function listByUser(userId: number): PlatformConnection[] {
  return query<PlatformConnectionRow>(
    "SELECT * FROM platform_connections WHERE user_id = ? ORDER BY platform",
    userId,
  ).map(rowToConnection);
}

export function upsert(
  userId: number,
  platform: "tistory" | "medium",
  data: {
    accessToken: string;
    blogName?: string | null;
    platformUserId?: string | null;
    platformUsername?: string | null;
  },
): PlatformConnection {
  const now = new Date().toISOString();
  const existing = getByUserAndPlatform(userId, platform);

  if (existing) {
    execute(
      `UPDATE platform_connections SET access_token = ?, blog_name = ?, platform_user_id = ?, platform_username = ?, updated_at = ?
       WHERE user_id = ? AND platform = ?`,
      data.accessToken,
      data.blogName ?? existing.blogName,
      data.platformUserId ?? existing.platformUserId,
      data.platformUsername ?? existing.platformUsername,
      now,
      userId,
      platform,
    );
  } else {
    execute(
      `INSERT INTO platform_connections (user_id, platform, access_token, blog_name, platform_user_id, platform_username, connected_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      userId,
      platform,
      data.accessToken,
      data.blogName ?? null,
      data.platformUserId ?? null,
      data.platformUsername ?? null,
      now,
      now,
    );
  }

  return getByUserAndPlatform(userId, platform)!;
}

export function remove(userId: number, platform: "tistory" | "medium"): boolean {
  const result = execute(
    "DELETE FROM platform_connections WHERE user_id = ? AND platform = ?",
    userId,
    platform,
  );
  return result.changes > 0;
}
