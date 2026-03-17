import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execute, query, queryOne } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";

let userId: number;
let sessionToken: string;

beforeEach(async () => {
  const email = `test-onboarding-${Date.now()}-${Math.random()}@example.com`;
  const result = await execute(
    `INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)`,
    email, "test_hash", new Date().toISOString()
  );
  userId = result.lastInsertRowid;
  sessionToken = await createSessionToken(userId);
});

afterEach(async () => {
  await execute("DELETE FROM user_profiles WHERE user_id = ?", userId);
  await execute("DELETE FROM users WHERE id = ?", userId);
});

function profileRequest(method: string, body?: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.cookie = `session_token=${token}`;
  return new Request("http://localhost:3000/api/profile", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Onboarding profile page — API integration", () => {
  it("GET returns { profile: null } when no profile exists (empty form state)", async () => {
    const { GET } = await import("@/app/api/profile/route");
    const res = await GET(profileRequest("GET", undefined, sessionToken) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile).toBeNull();
  });

  it("GET returns existing profile data so the form can be prefilled", async () => {
    await execute(
      `INSERT INTO user_profiles (user_id, nickname, age_group, preferred_tone, primary_platform, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      userId, "Alice", "30s", "detailed", "medium", new Date().toISOString(), new Date().toISOString()
    );

    const { GET } = await import("@/app/api/profile/route");
    const res = await GET(profileRequest("GET", undefined, sessionToken) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile).toBeDefined();
    expect(body.profile.nickname).toBe("Alice");
    expect(body.profile.ageGroup).toBe("30s");
    expect(body.profile.preferredTone).toBe("detailed");
    expect(body.profile.primaryPlatform).toBe("medium");
  });

  it("POST returns 400 with error.fields so field errors can be rendered", async () => {
    const { POST } = await import("@/app/api/profile/route");
    const res = await POST(
      profileRequest(
        "POST",
        { nickname: "", ageGroup: "invalid", preferredTone: "casual", primaryPlatform: "naver" },
        sessionToken,
      ) as any,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.fields).toBeDefined();
    expect(typeof body.error.fields.nickname).toBe("string");
    expect(typeof body.error.fields.ageGroup).toBe("string");
  });

  it("POST creates profile then PATCH updates it (full round-trip)", async () => {
    const { POST, PATCH } = await import("@/app/api/profile/route");

    const postRes = await POST(
      profileRequest(
        "POST",
        { nickname: "Bob", ageGroup: "20s", preferredTone: "casual", primaryPlatform: "naver" },
        sessionToken,
      ) as any,
    );
    expect(postRes.status).toBe(200);

    const patchRes = await PATCH(
      profileRequest("PATCH", { nickname: "BobUpdated", primaryPlatform: "tistory" }, sessionToken) as any,
    );
    expect(patchRes.status).toBe(200);
    const body = await patchRes.json();
    expect(body.profile.nickname).toBe("BobUpdated");
    expect(body.profile.primaryPlatform).toBe("tistory");
    expect(body.profile.ageGroup).toBe("20s");
  });

  it("GET returns 401 when unauthenticated (page should redirect to login)", async () => {
    const { GET } = await import("@/app/api/profile/route");
    const res = await GET(profileRequest("GET") as any);
    expect(res.status).toBe(401);
  });
});
