import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSessionToken, getSessionUserId } from "@/lib/auth";
import { execute, query, getDb } from "@/lib/db";
import { applyAppSchema } from "@/lib/db/appSchema";
import { GET } from "@/app/api/style-profiles/route";
import type { NextRequest } from "next/server";

applyAppSchema(getDb());
getSessionUserId("__init__");

function makeRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token) headers.set("cookie", `session_token=${token}`);
  return new Request("http://localhost/api/style-profiles", { headers }) as unknown as NextRequest;
}

const testEmail = `packet-0007-${Date.now()}@example.com`;
const otherEmail = `packet-0007-other-${Date.now()}@example.com`;
let testUserId: number;
let otherUserId: number;

beforeEach(() => {
  execute("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)", testEmail, "hash", "User 0007");
  execute("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)", otherEmail, "hash", "Other 0007");
  testUserId = query<{ id: number }>("SELECT id FROM users WHERE email = ?", testEmail)[0].id;
  otherUserId = query<{ id: number }>("SELECT id FROM users WHERE email = ?", otherEmail)[0].id;
});

afterEach(() => {
  execute("DELETE FROM style_profiles WHERE user_id = ?", testUserId);
  execute("DELETE FROM style_profiles WHERE user_id = ?", otherUserId);
  execute("DELETE FROM sessions WHERE userId = ?", testUserId);
  execute("DELETE FROM sessions WHERE userId = ?", otherUserId);
  execute("DELETE FROM users WHERE email = ?", testEmail);
  execute("DELETE FROM users WHERE email = ?", otherEmail);
});

describe("GET /api/style-profiles", () => {
  it("returns 401 with error.code when unauthenticated", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(typeof body.error.code).toBe("string");
    expect(body.error.code.length).toBeGreaterThan(0);
  });

  it("returns 200 with 2 presets on a fresh DB", async () => {
    const token = createSessionToken(testUserId);
    const res = await GET(makeRequest(token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.presets.length).toBe(2);
    expect(Array.isArray(body.customs)).toBe(true);
  });

  it("returns only summary fields in camelCase", async () => {
    const token = createSessionToken(testUserId);
    const res = await GET(makeRequest(token));
    const body = await res.json();
    const preset = body.presets[0];
    expect(typeof preset.id).toBe("number");
    expect(typeof preset.name).toBe("string");
    expect(typeof preset.isSystemPreset).toBe("boolean");
    expect(typeof preset.createdAt).toBe("string");
    expect(typeof preset.updatedAt).toBe("string");
    // no heavy fields
    expect(preset.sampleTexts).toBeUndefined();
    expect(preset.analyzedTone).toBeUndefined();
  });

  it("customs list contains only the caller's rows", async () => {
    const now = new Date().toISOString();
    execute(
      `INSERT INTO style_profiles (user_id, name, is_system_preset, sample_texts_json, analyzed_tone_json, created_at, updated_at)
       VALUES (?, ?, 0, ?, ?, ?, ?)`,
      testUserId, "My Profile", "[]", "{}", now, now,
    );
    execute(
      `INSERT INTO style_profiles (user_id, name, is_system_preset, sample_texts_json, analyzed_tone_json, created_at, updated_at)
       VALUES (?, ?, 0, ?, ?, ?, ?)`,
      otherUserId, "Other Profile", "[]", "{}", now, now,
    );

    const token = createSessionToken(testUserId);
    const res = await GET(makeRequest(token));
    const body = await res.json();
    expect(body.customs.length).toBe(1);
    expect(body.customs[0].name).toBe("My Profile");
  });

  it("presets are included even when caller has no customs", async () => {
    const token = createSessionToken(testUserId);
    const res = await GET(makeRequest(token));
    const body = await res.json();
    expect(body.presets.length).toBe(2);
    expect(body.customs.length).toBe(0);
  });
});
