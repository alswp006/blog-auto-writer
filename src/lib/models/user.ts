import { queryOne, execute } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";

export type User = {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type SafeUser = Omit<User, "password_hash">;

function toSafe(user: User): SafeUser {
  const { password_hash: _, ...safe } = user;
  return safe;
}

export async function createUser(email: string, password: string, name: string): Promise<SafeUser> {
  const existing = queryOne<User>("SELECT * FROM users WHERE email = ?", email);
  if (existing) throw new Error("Email already in use");

  const hash = await hashPassword(password);
  const result = execute(
    "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
    email, hash, name,
  );

  const user = queryOne<User>("SELECT * FROM users WHERE id = ?", result.lastInsertRowid);
  if (!user) throw new Error("Failed to create user");
  return toSafe(user);
}

export async function authenticateUser(email: string, password: string): Promise<SafeUser | null> {
  const user = queryOne<User>("SELECT * FROM users WHERE email = ?", email);
  if (!user) return null;

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  return toSafe(user);
}

export function getUserById(id: number): SafeUser | null {
  const user = queryOne<User>("SELECT * FROM users WHERE id = ?", id);
  if (!user) return null;
  return toSafe(user);
}

export function getUserByEmail(email: string): SafeUser | null {
  const user = queryOne<User>("SELECT * FROM users WHERE email = ?", email);
  if (!user) return null;
  return toSafe(user);
}
