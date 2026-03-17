import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { query, execute } from "@/lib/db";

describe("Database", () => {
  it("should create users table automatically", async () => {
    const tables = await query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
    );
    expect(tables).toHaveLength(1);
  });

  it("should insert and query a user", async () => {
    await execute("DELETE FROM users WHERE email = ?", "test-db@example.com");
    await execute(
      "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
      "test-db@example.com", "hash123", "Test User",
    );
    const users = await query("SELECT * FROM users WHERE email = ?", "test-db@example.com");
    expect(users).toHaveLength(1);
    expect((users[0] as Record<string, unknown>).name).toBe("Test User");
    // Cleanup
    await execute("DELETE FROM users WHERE email = ?", "test-db@example.com");
  });
});

describe("Password hashing", () => {
  it("should hash and verify correctly", async () => {
    const hash = await hashPassword("mypassword123");
    expect(hash).not.toBe("mypassword123");
    expect(hash.length).toBeGreaterThan(20);

    const valid = await verifyPassword("mypassword123", hash);
    expect(valid).toBe(true);

    const invalid = await verifyPassword("wrongpassword", hash);
    expect(invalid).toBe(false);
  });
});
