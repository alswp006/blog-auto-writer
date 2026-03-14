import { query, queryOne, execute } from "@/lib/db";

export type AllowedEmail = {
  id: number;
  email: string;
  memo: string | null;
  createdAt: string;
};

type AllowedEmailRow = {
  id: number;
  email: string;
  memo: string | null;
  created_at: string;
};

function rowToAllowedEmail(row: AllowedEmailRow): AllowedEmail {
  return {
    id: row.id,
    email: row.email,
    memo: row.memo,
    createdAt: row.created_at,
  };
}

/** Check if email is allowed to sign up */
export async function isAllowed(email: string): Promise<boolean> {
  // If no allowed_emails exist at all, allow everyone (open registration)
  const count = await queryOne<{ cnt: number }>("SELECT COUNT(*) as cnt FROM allowed_emails");
  if (!count || count.cnt === 0) return true;

  const row = await queryOne<AllowedEmailRow>(
    "SELECT * FROM allowed_emails WHERE email = ?",
    email.trim().toLowerCase(),
  );
  return !!row;
}

/** List all allowed emails */
export async function list(): Promise<AllowedEmail[]> {
  return (await query<AllowedEmailRow>(
    "SELECT * FROM allowed_emails ORDER BY created_at DESC",
  )).map(rowToAllowedEmail);
}

/** Add an allowed email */
export async function add(email: string, memo?: string | null): Promise<AllowedEmail> {
  const now = new Date().toISOString();
  const result = await execute(
    "INSERT INTO allowed_emails (email, memo, created_at) VALUES (?, ?, ?)",
    email.trim().toLowerCase(),
    memo?.trim() || null,
    now,
  );
  const row = await queryOne<AllowedEmailRow>(
    "SELECT * FROM allowed_emails WHERE id = ?",
    result.lastInsertRowid,
  );
  if (!row) throw new Error("Failed to add allowed email");
  return rowToAllowedEmail(row);
}

/** Remove an allowed email by id */
export async function remove(id: number): Promise<boolean> {
  const result = await execute("DELETE FROM allowed_emails WHERE id = ?", id);
  return result.changes > 0;
}
