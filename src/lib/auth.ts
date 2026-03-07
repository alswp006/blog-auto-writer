import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getUserById } from "@/lib/models/user";
import { queryOne, execute } from "@/lib/db";
import type { SafeUser } from "@/lib/models/user";

const SESSION_COOKIE = "session_token";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// ── Password hashing ──

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── Session management (DB-backed) ──

/** Create a session token and store it in DB (no cookie — for tests and internal use) */
export async function createSessionToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  await execute(
    "INSERT INTO sessions (token, userId, expiresAt) VALUES (?, ?, ?)",
    token, userId, expiresAt,
  );
  return token;
}

/** Get userId from session token (for API routes that parse cookies manually) */
export async function getSessionUserId(token: string): Promise<number | null> {
  const session = await queryOne<{ userId: number; expiresAt: number }>(
    "SELECT userId, expiresAt FROM sessions WHERE token = ?",
    token,
  );
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    await execute("DELETE FROM sessions WHERE token = ?", token);
    return null;
  }
  return session.userId;
}

/** Create a session and set the cookie (for route handlers) */
export async function createSession(userId: number): Promise<string> {
  const token = await createSessionToken(userId);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await execute("DELETE FROM sessions WHERE token = ?", token);
    cookieStore.delete(SESSION_COOKIE);
  }
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = await getSessionUserId(token);
  if (!userId) return null;

  return await getUserById(userId);
}

/** Get session token from request headers (for middleware) */
export function getSessionTokenFromHeaders(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

/** Validate a session token (for middleware — no cookie store needed) */
export async function validateSessionToken(token: string): Promise<boolean> {
  const userId = await getSessionUserId(token);
  return userId !== null;
}
