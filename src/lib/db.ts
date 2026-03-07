import { createClient, type Client } from "@libsql/client";

const DB_URL = process.env.TURSO_DATABASE_URL || "file:app.db";
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

let _client: Client | null = null;
let _schemaReady = false;

function getClient(): Client {
  if (_client) return _client;
  _client = createClient({
    url: DB_URL,
    authToken: AUTH_TOKEN,
  });
  return _client;
}

async function ensureSchema(): Promise<void> {
  if (_schemaReady) return;
  const client = getClient();

  // Core tables
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      stripe_customer_id TEXT UNIQUE,
      stripe_subscription_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'inactive',
      tier TEXT NOT NULL DEFAULT 'free',
      current_period_end TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      expiresAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
  `);

  // App-specific schema
  const { applyAppSchema } = await import("@/lib/db/appSchema");
  await applyAppSchema(client);

  _schemaReady = true;
}

/** Run a query and return all rows */
export async function query<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]> {
  await ensureSchema();
  const client = getClient();
  const result = await client.execute({ sql, args: params as any[] });
  return result.rows as unknown as T[];
}

/** Run a query and return one row */
export async function queryOne<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | undefined> {
  const rows = await query<T>(sql, ...params);
  return rows[0];
}

/** Run an insert/update/delete and return changes info */
export async function execute(sql: string, ...params: unknown[]) {
  await ensureSchema();
  const client = getClient();
  const result = await client.execute({ sql, args: params as any[] });
  return {
    lastInsertRowid: Number(result.lastInsertRowid),
    changes: result.rowsAffected,
  };
}
