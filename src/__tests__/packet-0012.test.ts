import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execute } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";
import * as platformConnectionModel from "@/lib/models/platformConnection";
import * as userModel from "@/lib/models/user";

const TEST_EMAIL = `test-p0012-${Date.now()}@example.com`;

describe("Platform Connections (packet-0012)", () => {
  let userId: number;

  beforeEach(async () => {
    const user = await userModel.createUser(TEST_EMAIL, "password123", "Test User P12");
    userId = user.id;
  });

  afterEach(async () => {
    await execute("DELETE FROM platform_connections WHERE user_id = ?", userId);
    await execute("DELETE FROM sessions WHERE userId = ?", userId);
    await execute("DELETE FROM users WHERE id = ?", userId);
  });

  it("should create a tistory connection via upsert", async () => {
    const conn = await platformConnectionModel.upsert(userId, "tistory", {
      accessToken: "test_token_123",
      blogName: "myblog",
    });

    expect(conn.platform).toBe("tistory");
    expect(conn.accessToken).toBe("test_token_123");
    expect(conn.blogName).toBe("myblog");
    expect(conn.userId).toBe(userId);
  });

  it("should create a medium connection via upsert", async () => {
    const conn = await platformConnectionModel.upsert(userId, "medium", {
      accessToken: "medium_token_456",
      platformUserId: "user-123",
      platformUsername: "testuser",
    });

    expect(conn.platform).toBe("medium");
    expect(conn.accessToken).toBe("medium_token_456");
    expect(conn.platformUserId).toBe("user-123");
    expect(conn.platformUsername).toBe("testuser");
  });

  it("should update existing connection on second upsert", async () => {
    await platformConnectionModel.upsert(userId, "tistory", {
      accessToken: "old_token",
      blogName: "oldblog",
    });

    const updated = await platformConnectionModel.upsert(userId, "tistory", {
      accessToken: "new_token",
      blogName: "newblog",
    });

    expect(updated.accessToken).toBe("new_token");
    expect(updated.blogName).toBe("newblog");

    // Should still be only one connection
    const all = await platformConnectionModel.listByUser(userId);
    const tistoryConns = all.filter((c) => c.platform === "tistory");
    expect(tistoryConns.length).toBe(1);
  });

  it("should get by user and platform", async () => {
    await platformConnectionModel.upsert(userId, "tistory", {
      accessToken: "t1",
      blogName: "blog1",
    });
    await platformConnectionModel.upsert(userId, "medium", {
      accessToken: "m1",
      platformUsername: "user1",
    });

    const tistory = await platformConnectionModel.getByUserAndPlatform(userId, "tistory");
    expect(tistory).not.toBeNull();
    expect(tistory!.blogName).toBe("blog1");

    const medium = await platformConnectionModel.getByUserAndPlatform(userId, "medium");
    expect(medium).not.toBeNull();
    expect(medium!.platformUsername).toBe("user1");
  });

  it("should list all connections for user", async () => {
    await platformConnectionModel.upsert(userId, "tistory", { accessToken: "t1", blogName: "b1" });
    await platformConnectionModel.upsert(userId, "medium", { accessToken: "m1" });

    const list = await platformConnectionModel.listByUser(userId);
    expect(list.length).toBe(2);
  });

  it("should remove a connection", async () => {
    await platformConnectionModel.upsert(userId, "tistory", { accessToken: "t1", blogName: "b1" });

    const removed = await platformConnectionModel.remove(userId, "tistory");
    expect(removed).toBe(true);

    const conn = await platformConnectionModel.getByUserAndPlatform(userId, "tistory");
    expect(conn).toBeNull();
  });

  it("should return false when removing non-existent connection", async () => {
    const removed = await platformConnectionModel.remove(userId, "medium");
    expect(removed).toBe(false);
  });

  // API route tests
  it("GET /api/connections should return masked connections", async () => {
    await platformConnectionModel.upsert(userId, "tistory", { accessToken: "secret_token", blogName: "myblog" });

    const token = await createSessionToken(userId);
    const req = new Request("http://localhost/api/connections", {
      headers: { cookie: `session_token=${token}` },
    });

    const { GET } = await import("@/app/api/connections/route");
    const res = await GET(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.connections).toHaveLength(1);
    expect(data.connections[0].hasToken).toBe(true);
    expect(data.connections[0].blogName).toBe("myblog");
    // Token should NOT be in response
    expect(data.connections[0].accessToken).toBeUndefined();
  });

});
