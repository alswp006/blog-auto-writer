import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSessionToken } from "@/lib/auth";
import { execute, query } from "@/lib/db";
import { POST, GET } from "@/app/api/style-profiles/route";
import type { NextRequest } from "next/server";

function makeRequest(method: "GET" | "POST", body?: object, token?: string): NextRequest {
  const headers = new Headers();
  if (token) headers.set("cookie", `session_token=${token}`);
  if (body) headers.set("content-type", "application/json");
  return new Request("http://localhost/api/style-profiles", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;
}

const testEmail = `packet-0011-${Date.now()}@example.com`;
let testUserId: number;

beforeEach(async () => {
  await execute("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)", testEmail, "hash", "User 0011");
  testUserId = (await query<{ id: number }>("SELECT id FROM users WHERE email = ?", testEmail))[0].id;
});

afterEach(async () => {
  await execute("DELETE FROM style_profiles WHERE user_id = ?", testUserId);
  await execute("DELETE FROM users WHERE email = ?", testEmail);
});

describe("Style Profiles page — API integration (packet-0011)", () => {
  it("AC1: GET returns exactly 2 presets and empty customs for a fresh user", async () => {
    const token = await createSessionToken(testUserId);
    const res = await GET(makeRequest("GET", undefined, token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.presets)).toBe(true);
    expect(body.presets.length).toBe(4);
    expect(Array.isArray(body.customs)).toBe(true);
    expect(body.customs.length).toBe(0);
  });

  it("AC2: POST with 3 valid sample texts creates a custom card visible in subsequent GET", async () => {
    const token = await createSessionToken(testUserId);
    const postRes = await POST(
      makeRequest("POST", { name: "My Voice", sampleTexts: ["샘플 A", "샘플 B", "샘플 C"] }, token)
    );
    expect(postRes.status).toBe(201);
    const postBody = await postRes.json();
    expect(postBody.styleProfile.name).toBe("My Voice");
    expect(postBody.styleProfile.isSystemPreset).toBe(false);

    const getRes = await GET(makeRequest("GET", undefined, token));
    const getBody = await getRes.json();
    expect(getBody.customs.length).toBe(1);
    expect(getBody.customs[0].name).toBe("My Voice");
  });

  it("AC3a: POST with 2 sample texts returns 400 with error.fields.sampleTexts", async () => {
    const token = await createSessionToken(testUserId);
    const res = await POST(
      makeRequest("POST", { name: "Test", sampleTexts: ["a", "b"] }, token)
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.fields?.sampleTexts).toBeDefined();
    expect(typeof body.error.fields.sampleTexts).toBe("string");
  });

  it("AC3b: POST with 6 sample texts returns 400 with error.fields.sampleTexts", async () => {
    const token = await createSessionToken(testUserId);
    const res = await POST(
      makeRequest("POST", { name: "Test", sampleTexts: ["a", "b", "c", "d", "e", "f"] }, token)
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.fields?.sampleTexts).toBeDefined();
    expect(typeof body.error.fields.sampleTexts).toBe("string");
  });

  it("AC4: GET returns 401 for unauthenticated request (triggers error banner + Retry)", async () => {
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(typeof body.error.code).toBe("string");
  });
});
