import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSessionToken } from "@/lib/auth";
import { execute, query } from "@/lib/db";
import { GET } from "@/app/api/profile/route";
import type { NextRequest } from "next/server";

function makeRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token) headers.set("cookie", `session_token=${token}`);
  return new Request("http://localhost/api/profile", { headers }) as unknown as NextRequest;
}

const testEmail = `packet-0005-${Date.now()}@example.com`;
let testUserId: number;

beforeEach(async () => {
  await execute(
    "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
    testEmail, "hash", "Test User 0005",
  );
  const users = await query<{ id: number }>("SELECT id FROM users WHERE email = ?", testEmail);
  testUserId = users[0].id;
});

afterEach(async () => {
  await execute("DELETE FROM user_profiles WHERE user_id = ?", testUserId);
  await execute("DELETE FROM sessions WHERE userId = ?", testUserId);
  await execute("DELETE FROM users WHERE email = ?", testEmail);
});

describe("GET /api/profile", () => {
  it("returns 401 with error.code when unauthenticated", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(typeof body.error.code).toBe("string");
    expect(body.error.code.length).toBeGreaterThan(0);
  });

  it("returns 200 with profile null when no user_profiles row exists", async () => {
    const token = await createSessionToken(testUserId);
    const res = await GET(makeRequest(token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile).toBeNull();
  });

  it("returns 200 with camelCase profile fields when profile exists", async () => {
    await execute(
      `INSERT INTO user_profiles (user_id, nickname, age_group, preferred_tone, primary_platform, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      testUserId, "TestNick", "30s", "casual", "naver",
      new Date().toISOString(), new Date().toISOString(),
    );

    const token = await createSessionToken(testUserId);
    const res = await GET(makeRequest(token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.nickname).toBe("TestNick");
    expect(body.profile.ageGroup).toBe("30s");
    expect(body.profile.preferredTone).toBe("casual");
    expect(body.profile.primaryPlatform).toBe("naver");
    expect(typeof body.profile.createdAt).toBe("string");
    expect(typeof body.profile.updatedAt).toBe("string");
  });

  it("does not include id or userId in response", async () => {
    await execute(
      `INSERT INTO user_profiles (user_id, nickname, age_group, preferred_tone, primary_platform, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      testUserId, "NoIdNick", "20s", "detailed", "tistory",
      new Date().toISOString(), new Date().toISOString(),
    );

    const token = await createSessionToken(testUserId);
    const res = await GET(makeRequest(token));
    const body = await res.json();
    expect(body.profile.id).toBeUndefined();
    expect(body.profile.userId).toBeUndefined();
  });
});
