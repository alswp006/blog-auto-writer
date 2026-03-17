import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSessionToken } from "@/lib/auth";
import { execute, query } from "@/lib/db";
import { POST, GET } from "@/app/api/style-profiles/route";
import type { NextRequest } from "next/server";

function makeRequest(
  method: "GET" | "POST",
  body?: object,
  token?: string
): NextRequest {
  const headers = new Headers();
  if (token) headers.set("cookie", `session_token=${token}`);
  if (body) {
    headers.set("content-type", "application/json");
  }
  const reqInit: RequestInit = {
    method,
    headers,
  };
  if (body) {
    reqInit.body = JSON.stringify(body);
  }
  return new Request("http://localhost/api/style-profiles", reqInit) as unknown as NextRequest;
}

const testEmail = `packet-0008-${Date.now()}@example.com`;
let testUserId: number;

beforeEach(async () => {
  await execute("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)", testEmail, "hash", "User 0008");
  testUserId = (await query<{ id: number }>("SELECT id FROM users WHERE email = ?", testEmail))[0].id;
});

afterEach(async () => {
  await execute("DELETE FROM style_profiles WHERE user_id = ?", testUserId);
  await execute("DELETE FROM sessions WHERE userId = ?", testUserId);
  await execute("DELETE FROM users WHERE email = ?", testEmail);
});

describe("POST /api/style-profiles", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST(makeRequest("POST", { name: "Test", sampleTexts: ["a", "b", "c"] }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(typeof body.error.code).toBe("string");
  });

  it("creates custom profile and returns 201 with sampleTexts length 3", async () => {
    const token = await createSessionToken(testUserId);
    const sampleTexts = ["첫 번째 샘플입니다", "두 번째 샘플입니다", "세 번째 샘플입니다"];
    const res = await POST(
      makeRequest("POST", { name: "My Style", sampleTexts }, token)
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.styleProfile.id).toBeDefined();
    expect(body.styleProfile.name).toBe("My Style");
    expect(body.styleProfile.sampleTexts.length).toBe(3);
    expect(Array.isArray(body.styleProfile.sampleTexts)).toBe(true);
    expect(body.styleProfile.isSystemPreset).toBe(false);
  });

  it("includes analyzedTone as non-null object in response", async () => {
    const token = await createSessionToken(testUserId);
    const sampleTexts = ["첫 번째", "두 번째", "세 번째"];
    const res = await POST(
      makeRequest("POST", { name: "Test Style", sampleTexts }, token)
    );
    const body = await res.json();
    expect(typeof body.styleProfile.analyzedTone).toBe("object");
    expect(body.styleProfile.analyzedTone).not.toBeNull();
    expect(typeof body.styleProfile.analyzedTone.tone).toBe("string");
    expect(typeof body.styleProfile.analyzedTone.formality).toBe("string");
    expect(typeof body.styleProfile.analyzedTone.emotion).toBe("string");
  });

  it("returns 400 with VALIDATION_ERROR when sampleTexts length is 2", async () => {
    const token = await createSessionToken(testUserId);
    const res = await POST(
      makeRequest("POST", { name: "Test", sampleTexts: ["a", "b"] }, token)
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(typeof body.error.fields.sampleTexts).toBe("string");
    expect(body.error.fields.sampleTexts.length).toBeGreaterThan(0);
  });

  it("returns 400 with VALIDATION_ERROR when sampleTexts length is 6", async () => {
    const token = await createSessionToken(testUserId);
    const sampleTexts = ["a", "b", "c", "d", "e", "f"];
    const res = await POST(
      makeRequest("POST", { name: "Test", sampleTexts }, token)
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(typeof body.error.fields.sampleTexts).toBe("string");
    expect(body.error.fields.sampleTexts.length).toBeGreaterThan(0);
  });

  it("returns 400 when sampleTexts contains empty strings", async () => {
    const token = await createSessionToken(testUserId);
    const res = await POST(
      makeRequest("POST", { name: "Test", sampleTexts: ["a", "", "c"] }, token)
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(typeof body.error.fields.sampleTexts).toBe("string");
  });

  it("persists profile in DB and appears in subsequent GET for same user", async () => {
    const token = await createSessionToken(testUserId);
    const sampleTexts = ["Sample 1", "Sample 2", "Sample 3"];
    const postRes = await POST(
      makeRequest("POST", { name: "Saved Style", sampleTexts }, token)
    );
    expect(postRes.status).toBe(201);

    // Verify in GET response
    const getRes = await GET(makeRequest("GET", undefined, token));
    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    expect(body.customs.length).toBe(1);
    expect(body.customs[0].name).toBe("Saved Style");
  });

  it("created profile is only visible to owning user", async () => {
    const token = await createSessionToken(testUserId);
    const sampleTexts = ["Sample 1", "Sample 2", "Sample 3"];
    await POST(
      makeRequest("POST", { name: "Private Style", sampleTexts }, token)
    );

    // Create another user
    const otherEmail = `packet-0008-other-${Date.now()}@example.com`;
    await execute("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)", otherEmail, "hash", "Other User");
    const otherUserId = (await query<{ id: number }>("SELECT id FROM users WHERE email = ?", otherEmail))[0].id;
    const otherToken = await createSessionToken(otherUserId);

    // Verify other user doesn't see the profile
    const otherRes = await GET(makeRequest("GET", undefined, otherToken));
    const otherBody = await otherRes.json();
    expect(otherBody.customs.length).toBe(0);

    // Cleanup
    await execute("DELETE FROM users WHERE email = ?", otherEmail);
  });
});
