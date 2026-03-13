import { query, queryOne, execute } from "@/lib/db";
import {
  type PlaceRow,
  type Place,
  type PlaceCategory,
  rowToPlace,
} from "@/lib/models/modelTypes";

export type CreatePlaceInput = {
  name: string;
  category: PlaceCategory;
  address?: string | null;
  rating?: number | null;
  memo?: string | null;
  userId?: number | null;
};

export type UpdatePlaceInput = Partial<CreatePlaceInput>;

export async function getById(id: number, userId?: number): Promise<Place | null> {
  const sql = userId != null
    ? "SELECT * FROM places WHERE id = ? AND user_id = ?"
    : "SELECT * FROM places WHERE id = ?";
  const args = userId != null ? [id, userId] : [id];
  const row = await queryOne<PlaceRow>(sql, ...args);
  return row ? rowToPlace(row) : null;
}

export async function list(userId?: number): Promise<Place[]> {
  const sql = userId != null
    ? "SELECT * FROM places WHERE user_id = ? ORDER BY created_at DESC, rowid DESC"
    : "SELECT * FROM places ORDER BY created_at DESC, rowid DESC";
  const args = userId != null ? [userId] : [];
  return (await query<PlaceRow>(sql, ...args)).map(rowToPlace);
}

export async function create(input: CreatePlaceInput): Promise<Place> {
  const now = new Date().toISOString();
  const result = await execute(
    `INSERT INTO places (user_id, name, category, address, rating, memo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    input.userId ?? null,
    input.name,
    input.category,
    input.address ?? null,
    input.rating ?? null,
    input.memo ?? null,
    now,
    now,
  );
  const row = await queryOne<PlaceRow>("SELECT * FROM places WHERE id = ?", result.lastInsertRowid);
  if (!row) throw new Error("Failed to create place");
  return rowToPlace(row);
}

export async function update(id: number, input: UpdatePlaceInput, userId?: number): Promise<Place | null> {
  const sql = userId != null
    ? "SELECT * FROM places WHERE id = ? AND user_id = ?"
    : "SELECT * FROM places WHERE id = ?";
  const args = userId != null ? [id, userId] : [id];
  const existing = await queryOne<PlaceRow>(sql, ...args);
  if (!existing) return null;

  const now = new Date().toISOString();
  await execute(
    `UPDATE places SET name = ?, category = ?, address = ?, rating = ?, memo = ?, updated_at = ? WHERE id = ?`,
    input.name ?? existing.name,
    input.category ?? existing.category,
    "address" in input ? (input.address ?? null) : existing.address,
    "rating" in input ? (input.rating ?? null) : existing.rating,
    "memo" in input ? (input.memo ?? null) : existing.memo,
    now,
    id,
  );

  return await getById(id);
}

export async function listByUser(userId: number): Promise<Place[]> {
  return (await query<PlaceRow>(
    `SELECT DISTINCT pl.* FROM places pl
     JOIN posts p ON p.place_id = pl.id
     WHERE p.user_id = ?
     ORDER BY pl.name ASC`,
    userId,
  )).map(rowToPlace);
}

export async function remove(id: number, userId?: number): Promise<boolean> {
  const sql = userId != null
    ? "DELETE FROM places WHERE id = ? AND user_id = ?"
    : "DELETE FROM places WHERE id = ?";
  const args = userId != null ? [id, userId] : [id];
  const result = await execute(sql, ...args);
  return result.changes > 0;
}
