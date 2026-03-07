import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { getDb, query, execute } from "@/lib/db";

describe("Database", () => {
  it("should create users table automatically", () => {
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").all();
    expect(tables).toHaveLength(1);
  });

  it("should insert and query a user", () => {
    execute("DELETE FROM users WHERE email = ?", "test-db@example.com");
    execute(
      "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
      "test-db@example.com", "hash123", "Test User"
    );
    const users = query("SELECT * FROM users WHERE email = ?", "test-db@example.com");
    expect(users).toHaveLength(1);
    expect((users[0] as Record<string, unknown>).name).toBe("Test User");
    // Cleanup
    execute("DELETE FROM users WHERE email = ?", "test-db@example.com");
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
