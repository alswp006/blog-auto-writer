import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSessionToken } from "@/lib/auth";
import { execute, query } from "@/lib/db";
import { jsonError } from "@/lib/api/errors";
import { requireAuthUser } from "@/lib/api/auth";
import { GET } from "@/app/api/_health-auth/route";
import type { NextRequest } from "next/server";

// Helper: create a NextRequest with optional session cookie
function makeRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token) headers.set("cookie", `session_token=${token}`);
  return new Request("http://localhost/api/_health-auth", { headers }) as unknown as NextRequest;
}

const testEmail = `packet-0000-${Date.now()}@example.com`;
let testUserId: number;

beforeEach(async () => {
  await execute(
    "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
    testEmail, "hash", "Test User 0000",
  );
  const users = await query<{ id: number }>("SELECT id FROM users WHERE email = ?", testEmail);
  testUserId = users[0].id;
});

afterEach(async () => {
  await execute("DELETE FROM sessions WHERE userId = ?", testUserId);
  await execute("DELETE FROM users WHERE email = ?", testEmail);
});

describe("jsonError", () => {
  it("returns correct status and error shape without fields", async () => {
    const res = jsonError(400, "BAD_REQUEST", "Something went wrong");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.message).toBe("Something went wrong");
    expect(body.error.fields).toBeUndefined();
  });

  it("includes fields when provided", async () => {
    const res = jsonError(422, "VALIDATION_ERROR", "Invalid input", { email: "Required" });
    const body = await res.json();
    expect(body.error.fields).toEqual({ email: "Required" });
  });
});

describe("requireAuthUser", () => {
  it("returns 401 with non-empty error.code when unauthenticated", async () => {
    const req = makeRequest();
    const result = await requireAuthUser(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(typeof body.error.code).toBe("string");
      expect(body.error.code.length).toBeGreaterThan(0);
    }
  });

  it("returns userId for valid session", async () => {
    const token = await createSessionToken(testUserId);
    const req = makeRequest(token);
    const result = await requireAuthUser(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe(testUserId);
    }
  });
});

describe("GET /api/_health-auth", () => {
  it("returns 401 when logged out", async () => {
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(typeof body.error.code).toBe("string");
    expect(body.error.code.length).toBeGreaterThan(0);
  });

  it("returns 200 with {ok:true} when logged in", async () => {
    const token = await createSessionToken(testUserId);
    const req = makeRequest(token);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
