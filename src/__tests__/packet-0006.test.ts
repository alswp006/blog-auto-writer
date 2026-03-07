import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb } from "@/lib/db";
import type Database from "better-sqlite3";
import { createSessionToken } from "@/lib/auth";

let db: Database.Database;
let userId: number;
let sessionToken: string;

beforeEach(() => {
  db = getDb();

  // Create a test user
  const timestamp = Date.now();
  const email = `test-profile-${timestamp}-${Math.random()}@example.com`;
  const result = db.prepare(
    `INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)`
  ).run(email, "test_hash", new Date().toISOString());

  userId = result.lastInsertRowid as number;
  sessionToken = createSessionToken(userId);
});

afterEach(() => {
  // Clean up profile first (child table)
  db.prepare("DELETE FROM user_profiles WHERE user_id = ?").run(userId);
  // Then clean up user (parent table)
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
});

function createRequest(
  method: string,
  body?: Record<string, unknown>,
  token?: string,
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (token) {
    headers.cookie = `session_token=${token}`;
  }

  return new Request("http://localhost:3000/api/profile", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/profile", () => {
  it("creates a profile with valid input and returns 200", async () => {
    const { POST } = await import("@/app/api/profile/route");

    const req = createRequest("POST", {
      nickname: "TestUser",
      ageGroup: "30s",
      preferredTone: "casual",
      primaryPlatform: "naver",
    }, sessionToken);

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.profile).toBeDefined();
    expect(body.profile.nickname).toBe("TestUser");
    expect(body.profile.ageGroup).toBe("30s");
    expect(body.profile.preferredTone).toBe("casual");
    expect(body.profile.primaryPlatform).toBe("naver");
    expect(body.profile.createdAt).toBeDefined();
    expect(body.profile.updatedAt).toBeDefined();
  });

  it("returns 400 VALIDATION_ERROR when profile already exists", async () => {
    const { POST } = await import("@/app/api/profile/route");

    // Create first profile
    const req1 = createRequest("POST", {
      nickname: "FirstProfile",
      ageGroup: "20s",
      preferredTone: "detailed",
      primaryPlatform: "tistory",
    }, sessionToken);

    const res1 = await POST(req1 as any);
    expect(res1.status).toBe(200);

    // Try to create another profile for same user
    const req2 = createRequest("POST", {
      nickname: "SecondProfile",
      ageGroup: "30s",
      preferredTone: "casual",
      primaryPlatform: "medium",
    }, sessionToken);

    const res2 = await POST(req2 as any);
    expect(res2.status).toBe(400);

    const body = await res2.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 with fields.ageGroup when ageGroup is invalid", async () => {
    const { POST } = await import("@/app/api/profile/route");

    const req = createRequest("POST", {
      nickname: "TestUser",
      ageGroup: "10s",
      preferredTone: "casual",
      primaryPlatform: "naver",
    }, sessionToken);

    const res = await POST(req as any);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields).toBeDefined();
    expect(body.error.fields.ageGroup).toBeTruthy();
    expect(typeof body.error.fields.ageGroup).toBe("string");
  });

  it("returns 401 when no session token provided", async () => {
    const { POST } = await import("@/app/api/profile/route");

    const req = createRequest("POST", {
      nickname: "TestUser",
      ageGroup: "30s",
      preferredTone: "casual",
      primaryPlatform: "naver",
    });

    const res = await POST(req as any);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when nickname exceeds 30 characters", async () => {
    const { POST } = await import("@/app/api/profile/route");

    const req = createRequest("POST", {
      nickname: "a".repeat(31),
      ageGroup: "30s",
      preferredTone: "casual",
      primaryPlatform: "naver",
    }, sessionToken);

    const res = await POST(req as any);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields.nickname).toBeTruthy();
  });
});

describe("PATCH /api/profile", () => {
  beforeEach(() => {
    // Create a profile for PATCH tests
    db.prepare(
      `INSERT INTO user_profiles (user_id, nickname, age_group, preferred_tone, primary_platform, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      "InitialProfile",
      "20s",
      "casual",
      "naver",
      new Date().toISOString(),
      new Date().toISOString(),
    );
  });

  it("returns 404 when profile does not exist", async () => {
    const { PATCH } = await import("@/app/api/profile/route");

    // Create new user without profile
    const timestamp = Date.now();
    const email = `test-patch-${timestamp}-${Math.random()}@example.com`;
    const result = db.prepare(
      `INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)`
    ).run(email, "test_hash", new Date().toISOString());

    const newUserId = result.lastInsertRowid as number;
    const newToken = createSessionToken(newUserId);

    try {
      const req = createRequest("PATCH", {
        preferredTone: "detailed",
      }, newToken);

      const res = await PATCH(req as any);
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    } finally {
      db.prepare("DELETE FROM users WHERE id = ?").run(newUserId);
    }
  });

  it("updates preferredTone and returns 200", async () => {
    const { PATCH } = await import("@/app/api/profile/route");

    const req = createRequest("PATCH", {
      preferredTone: "detailed",
    }, sessionToken);

    const res = await PATCH(req as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.profile).toBeDefined();
    expect(body.profile.preferredTone).toBe("detailed");
    expect(body.profile.nickname).toBe("InitialProfile");
  });

  it("updates multiple fields", async () => {
    const { PATCH } = await import("@/app/api/profile/route");

    const req = createRequest("PATCH", {
      nickname: "UpdatedName",
      ageGroup: "40plus",
      primaryPlatform: "medium",
    }, sessionToken);

    const res = await PATCH(req as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.profile.nickname).toBe("UpdatedName");
    expect(body.profile.ageGroup).toBe("40plus");
    expect(body.profile.primaryPlatform).toBe("medium");
    expect(body.profile.preferredTone).toBe("casual");
  });

  it("returns 400 with fields when invalid data is provided", async () => {
    const { PATCH } = await import("@/app/api/profile/route");

    const req = createRequest("PATCH", {
      ageGroup: "invalid",
    }, sessionToken);

    const res = await PATCH(req as any);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields.ageGroup).toBeTruthy();
  });

  it("returns 401 when no session token provided", async () => {
    const { PATCH } = await import("@/app/api/profile/route");

    const req = createRequest("PATCH", {
      preferredTone: "detailed",
    });

    const res = await PATCH(req as any);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
