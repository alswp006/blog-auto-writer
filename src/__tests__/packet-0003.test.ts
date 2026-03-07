import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { applyAppSchema } from "@/lib/db/appSchema";

function makeDb() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  applyAppSchema(db);
  return db;
}

describe("posts table schema", () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    db.close();
  });

  it("creates posts table with correct structure", () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='posts'")
      .all() as { name: string }[];
    expect(tables).toHaveLength(1);
  });

  it("inserts a draft post with JSON defaults", () => {
    const now = new Date().toISOString();
    const uid = `p3-${Date.now()}-${Math.random()}`;

    db.prepare(
      `INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, 'hash', ?, ?)`,
    ).run(`${uid}@test.com`, now, now);
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(`${uid}@test.com`) as {
      id: number;
    };

    db.prepare(
      `INSERT INTO places (name, category, created_at, updated_at) VALUES ('Test Place', 'cafe', ?, ?)`,
    ).run(now, now);
    const place = db
      .prepare("SELECT id FROM places ORDER BY rowid DESC LIMIT 1")
      .get() as { id: number };

    const style = db
      .prepare("SELECT id FROM style_profiles WHERE is_system_preset = 1 LIMIT 1")
      .get() as { id: number };

    db.prepare(
      `INSERT INTO posts (user_id, place_id, style_profile_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?)`,
    ).run(user.id, place.id, style.id, now, now);

    const post = db
      .prepare("SELECT * FROM posts ORDER BY rowid DESC LIMIT 1")
      .get() as Record<string, unknown>;

    expect(post.hashtags_ko_json).toBe("[]");
    expect(post.hashtags_en_json).toBe("[]");
    expect(post.status).toBe("draft");
  });

  it("rejects invalid status value", () => {
    const now = new Date().toISOString();
    const uid = `p3b-${Date.now()}-${Math.random()}`;

    db.prepare(
      `INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, 'hash', ?, ?)`,
    ).run(`${uid}@test.com`, now, now);
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(`${uid}@test.com`) as {
      id: number;
    };

    db.prepare(
      `INSERT INTO places (name, category, created_at, updated_at) VALUES ('Test2', 'restaurant', ?, ?)`,
    ).run(now, now);
    const place = db
      .prepare("SELECT id FROM places ORDER BY rowid DESC LIMIT 1")
      .get() as { id: number };

    const style = db
      .prepare("SELECT id FROM style_profiles WHERE is_system_preset = 1 LIMIT 1")
      .get() as { id: number };

    expect(() => {
      db.prepare(
        `INSERT INTO posts (user_id, place_id, style_profile_id, status, created_at, updated_at)
         VALUES (?, ?, ?, 'published', ?, ?)`,
      ).run(user.id, place.id, style.id, now, now);
    }).toThrow();
  });

  it("cascades delete when user is deleted", () => {
    const now = new Date().toISOString();
    const uid = `p3c-${Date.now()}-${Math.random()}`;

    db.prepare(
      `INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, 'hash', ?, ?)`,
    ).run(`${uid}@test.com`, now, now);
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(`${uid}@test.com`) as {
      id: number;
    };

    db.prepare(
      `INSERT INTO places (name, category, created_at, updated_at) VALUES ('Test3', 'cafe', ?, ?)`,
    ).run(now, now);
    const place = db
      .prepare("SELECT id FROM places ORDER BY rowid DESC LIMIT 1")
      .get() as { id: number };

    const style = db
      .prepare("SELECT id FROM style_profiles WHERE is_system_preset = 1 LIMIT 1")
      .get() as { id: number };

    db.prepare(
      `INSERT INTO posts (user_id, place_id, style_profile_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?)`,
    ).run(user.id, place.id, style.id, now, now);

    db.exec("PRAGMA foreign_keys = ON");
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);

    const posts = db
      .prepare("SELECT * FROM posts WHERE user_id = ?")
      .all(user.id) as unknown[];
    expect(posts).toHaveLength(0);
  });

  it("stores generated post with content", () => {
    const now = new Date().toISOString();
    const uid = `p3d-${Date.now()}-${Math.random()}`;

    db.prepare(
      `INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, 'hash', ?, ?)`,
    ).run(`${uid}@test.com`, now, now);
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(`${uid}@test.com`) as {
      id: number;
    };

    db.prepare(
      `INSERT INTO places (name, category, created_at, updated_at) VALUES ('Test4', 'cafe', ?, ?)`,
    ).run(now, now);
    const place = db
      .prepare("SELECT id FROM places ORDER BY rowid DESC LIMIT 1")
      .get() as { id: number };

    const style = db
      .prepare("SELECT id FROM style_profiles WHERE is_system_preset = 1 LIMIT 1")
      .get() as { id: number };

    db.prepare(
      `INSERT INTO posts (user_id, place_id, style_profile_id, title_ko, content_ko, hashtags_ko_json,
       title_en, content_en, hashtags_en_json, status, created_at, updated_at)
       VALUES (?, ?, ?, '카페 리뷰', '맛있어요', '["#cafe"]', 'Cafe Review', 'Delicious', '["#cafe"]', 'generated', ?, ?)`,
    ).run(user.id, place.id, style.id, now, now);

    const post = db
      .prepare("SELECT * FROM posts ORDER BY rowid DESC LIMIT 1")
      .get() as Record<string, unknown>;

    expect(post.status).toBe("generated");
    expect(post.title_ko).toBe("카페 리뷰");
    expect(post.hashtags_en_json).toBe('["#cafe"]');
  });
});
