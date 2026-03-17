import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { query, queryOne, execute } from "@/lib/db";

const uid = `p3-${Date.now()}`;

// Track IDs created in each test for cleanup
let createdUserIds: number[] = [];
let createdPlaceIds: number[] = [];
let createdPostIds: number[] = [];

async function createTestUser(suffix: string) {
  const now = new Date().toISOString();
  const email = `${uid}-${suffix}-${Math.random()}@test.com`;
  const { lastInsertRowid } = await execute(
    `INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, 'hash', ?, ?)`,
    email,
    now,
    now,
  );
  createdUserIds.push(lastInsertRowid);
  return { id: lastInsertRowid, email };
}

async function createTestPlace(name: string, category: string) {
  const now = new Date().toISOString();
  const { lastInsertRowid } = await execute(
    `INSERT INTO places (name, category, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    name,
    category,
    now,
    now,
  );
  createdPlaceIds.push(lastInsertRowid);
  return { id: lastInsertRowid };
}

async function getSystemStyleProfile() {
  const style = await queryOne<{ id: number }>(
    "SELECT id FROM style_profiles WHERE is_system_preset = 1 LIMIT 1",
  );
  if (!style) throw new Error("No system style preset found");
  return style;
}

describe("posts table schema", () => {
  beforeEach(async () => {
    createdUserIds = [];
    createdPlaceIds = [];
    createdPostIds = [];
  });

  afterEach(async () => {
    // Delete child tables first (foreign key order)
    for (const postId of createdPostIds) {
      await execute("DELETE FROM publish_history WHERE post_id = ?", postId);
      await execute("DELETE FROM post_analytics WHERE post_id = ?", postId);
      await execute("DELETE FROM post_versions WHERE post_id = ?", postId);
    }
    for (const postId of createdPostIds) {
      await execute("DELETE FROM posts WHERE id = ?", postId);
    }
    for (const placeId of createdPlaceIds) {
      await execute("DELETE FROM menu_items WHERE place_id = ?", placeId);
      await execute("DELETE FROM photos WHERE place_id = ?", placeId);
    }
    for (const placeId of createdPlaceIds) {
      await execute("DELETE FROM places WHERE id = ?", placeId);
    }
    for (const userId of createdUserIds) {
      await execute("DELETE FROM posts WHERE user_id = ?", userId);
      await execute("DELETE FROM user_profiles WHERE user_id = ?", userId);
      await execute("DELETE FROM platform_connections WHERE user_id = ?", userId);
      await execute("DELETE FROM api_usage WHERE user_id = ?", userId);
      await execute("DELETE FROM sessions WHERE userId = ?", userId);
      await execute("DELETE FROM subscriptions WHERE user_id = ?", userId);
    }
    for (const userId of createdUserIds) {
      await execute("DELETE FROM users WHERE id = ?", userId);
    }
  });

  it("creates posts table with correct structure", async () => {
    const tables = await query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='posts'",
    );
    expect(tables).toHaveLength(1);
  });

  it("inserts a draft post with JSON defaults", async () => {
    const now = new Date().toISOString();
    const user = await createTestUser("draft");
    const place = await createTestPlace("Test Place", "cafe");
    const style = await getSystemStyleProfile();

    const { lastInsertRowid } = await execute(
      `INSERT INTO posts (user_id, place_id, style_profile_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?)`,
      user.id,
      place.id,
      style.id,
      now,
      now,
    );
    createdPostIds.push(lastInsertRowid);

    const post = await queryOne<Record<string, unknown>>(
      "SELECT * FROM posts WHERE id = ?",
      lastInsertRowid,
    );

    expect(post).toBeDefined();
    expect(post!.hashtags_ko_json).toBe("[]");
    expect(post!.hashtags_en_json).toBe("[]");
    expect(post!.status).toBe("draft");
  });

  it("rejects invalid status value", async () => {
    const now = new Date().toISOString();
    const user = await createTestUser("invalid-status");
    const place = await createTestPlace("Test2", "restaurant");
    const style = await getSystemStyleProfile();

    await expect(
      execute(
        `INSERT INTO posts (user_id, place_id, style_profile_id, status, created_at, updated_at)
         VALUES (?, ?, ?, 'published', ?, ?)`,
        user.id,
        place.id,
        style.id,
        now,
        now,
      ),
    ).rejects.toThrow();
  });

  it("cascades delete when user is deleted", async () => {
    const now = new Date().toISOString();
    const user = await createTestUser("cascade");
    const place = await createTestPlace("Test3", "cafe");
    const style = await getSystemStyleProfile();

    const { lastInsertRowid } = await execute(
      `INSERT INTO posts (user_id, place_id, style_profile_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?)`,
      user.id,
      place.id,
      style.id,
      now,
      now,
    );
    createdPostIds.push(lastInsertRowid);

    // Enable foreign keys and delete the user — posts should cascade
    await execute("PRAGMA foreign_keys = ON");
    await execute("DELETE FROM users WHERE id = ?", user.id);
    // User is deleted, so remove from cleanup list to avoid double-delete errors
    createdUserIds = createdUserIds.filter((id) => id !== user.id);
    // Post should be cascade-deleted too
    createdPostIds = createdPostIds.filter((id) => id !== lastInsertRowid);

    const posts = await query<Record<string, unknown>>(
      "SELECT * FROM posts WHERE user_id = ?",
      user.id,
    );
    expect(posts).toHaveLength(0);
  });

  it("stores generated post with content", async () => {
    const now = new Date().toISOString();
    const user = await createTestUser("generated");
    const place = await createTestPlace("Test4", "cafe");
    const style = await getSystemStyleProfile();

    const { lastInsertRowid } = await execute(
      `INSERT INTO posts (user_id, place_id, style_profile_id, title_ko, content_ko, hashtags_ko_json,
       title_en, content_en, hashtags_en_json, status, created_at, updated_at)
       VALUES (?, ?, ?, '카페 리뷰', '맛있어요', '["#cafe"]', 'Cafe Review', 'Delicious', '["#cafe"]', 'generated', ?, ?)`,
      user.id,
      place.id,
      style.id,
      now,
      now,
    );
    createdPostIds.push(lastInsertRowid);

    const post = await queryOne<Record<string, unknown>>(
      "SELECT * FROM posts WHERE id = ?",
      lastInsertRowid,
    );

    expect(post).toBeDefined();
    expect(post!.status).toBe("generated");
    expect(post!.title_ko).toBe("카페 리뷰");
    expect(post!.hashtags_en_json).toBe('["#cafe"]');
  });
});
