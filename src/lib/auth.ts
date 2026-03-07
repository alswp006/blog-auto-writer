import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getUserById } from "@/lib/models/user";
import { getDb, queryOne, execute } from "@/lib/db";
import type { SafeUser } from "@/lib/models/user";

const SESSION_COOKIE = "session_token";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Ensure sessions table exists (idempotent, called lazily)
let _sessionsTableReady = false;
function ensureSessionsTable(): void {
  if (_sessionsTableReady) return;
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      expiresAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
  `);
  _sessionsTableReady = true;
}

// ── Password hashing ──

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── Session management (DB-backed) ──

/** Create a session token and store it in DB (no cookie — for tests and internal use) */
export function createSessionToken(userId: number): string {
  ensureSessionsTable();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  execute(
    "INSERT INTO sessions (token, userId, expiresAt) VALUES (?, ?, ?)",
    token, userId, expiresAt,
  );
  return token;
}

/** Get userId from session token (for API routes that parse cookies manually) */
export function getSessionUserId(token: string): number | null {
  ensureSessionsTable();
  const session = queryOne<{ userId: number; expiresAt: number }>(
    "SELECT userId, expiresAt FROM sessions WHERE token = ?",
    token,
  );
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    execute("DELETE FROM sessions WHERE token = ?", token);
    return null;
  }
  return session.userId;
}

/** Create a session and set the cookie (for route handlers) */
export async function createSession(userId: number): Promise<string> {
  const token = createSessionToken(userId);

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
  ensureSessionsTable();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    execute("DELETE FROM sessions WHERE token = ?", token);
    cookieStore.delete(SESSION_COOKIE);
  }
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = getSessionUserId(token);
  if (!userId) return null;

  return getUserById(userId);
}

/** Get session token from request headers (for middleware) */
export function getSessionTokenFromHeaders(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

/** Validate a session token (for middleware — no cookie store needed) */
export function validateSessionToken(token: string): boolean {
  const userId = getSessionUserId(token);
  return userId !== null;
}
