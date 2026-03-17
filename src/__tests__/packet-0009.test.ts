import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSessionToken } from "@/lib/auth";
import { execute, query } from "@/lib/db";
import { GET } from "@/app/api/style-profiles/[id]/route";
import type { NextRequest } from "next/server";

function makeRequest(id: string, token?: string): NextRequest {
  const headers = new Headers();
  if (token) headers.set("cookie", `session_token=${token}`);
  return new Request(`http://localhost/api/style-profiles/${id}`, {
    method: "GET",
    headers,
  }) as unknown as NextRequest;
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

const testEmail = `packet-0009-${Date.now()}@example.com`;
let testUserId: number;
let customProfileId: number;

beforeEach(async () => {
  await execute(
    "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
    testEmail,
    "hash",
    "User 0009",
  );
  testUserId = (await query<{ id: number }>(
    "SELECT id FROM users WHERE email = ?",
    testEmail,
  ))[0].id;

  const now = new Date().toISOString();
  await execute(
    `INSERT INTO style_profiles (user_id, name, is_system_preset, sample_texts_json, analyzed_tone_json, created_at, updated_at)
     VALUES (?, ?, 0, ?, ?, ?, ?)`,
    testUserId,
    "My Custom Style",
    JSON.stringify(["text one", "text two", "text three"]),
    JSON.stringify({ tone: "casual" }),
    now,
    now,
  );
  customProfileId = (await query<{ id: number }>(
    "SELECT id FROM style_profiles WHERE user_id = ? AND is_system_preset = 0",
    testUserId,
  ))[0].id;
});

afterEach(async () => {
  await execute("DELETE FROM style_profiles WHERE user_id = ?", testUserId);
  await execute("DELETE FROM users WHERE email = ?", testEmail);
});

describe("GET /api/style-profiles/:id", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest("1"), makeParams("1"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(typeof body.error.code).toBe("string");
  });

  it("returns system preset to any authenticated user with isSystemPreset===true", async () => {
    const token = await createSessionToken(testUserId);
    // System presets have ids 1 and 2 from seed
    const presets = await query<{ id: number }>(
      "SELECT id FROM style_profiles WHERE is_system_preset = 1 LIMIT 1",
    );
    expect(presets.length).toBeGreaterThan(0);
    const presetId = String(presets[0].id);
    const res = await GET(makeRequest(presetId, token), makeParams(presetId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.styleProfile.isSystemPreset).toBe(true);
    expect(Array.isArray(body.styleProfile.sampleTexts)).toBe(true);
    expect(body.styleProfile).not.toHaveProperty("userId");
  });

  it("returns custom profile to owner with sampleTexts length 3", async () => {
    const token = await createSessionToken(testUserId);
    const id = String(customProfileId);
    const res = await GET(makeRequest(id, token), makeParams(id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.styleProfile.sampleTexts.length).toBe(3);
    expect(body.styleProfile.sampleTexts.length).toBeGreaterThanOrEqual(3);
    expect(body.styleProfile.sampleTexts.length).toBeLessThanOrEqual(5);
    expect(body.styleProfile).not.toHaveProperty("userId");
  });

  it("returns 404 when another user requests a custom profile", async () => {
    const otherEmail = `packet-0009-other-${Date.now()}@example.com`;
    await execute(
      "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
      otherEmail,
      "hash",
      "Other User",
    );
    const otherUserId = (await query<{ id: number }>(
      "SELECT id FROM users WHERE email = ?",
      otherEmail,
    ))[0].id;
    const otherToken = await createSessionToken(otherUserId);

    const id = String(customProfileId);
    const res = await GET(makeRequest(id, otherToken), makeParams(id));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");

    await execute("DELETE FROM users WHERE email = ?", otherEmail);
  });

  it("returns 404 for non-existent profile id", async () => {
    const token = await createSessionToken(testUserId);
    const res = await GET(makeRequest("999999", token), makeParams("999999"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
