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
};

export type UpdatePlaceInput = Partial<CreatePlaceInput>;

export function getById(id: number): Place | null {
  const row = queryOne<PlaceRow>("SELECT * FROM places WHERE id = ?", id);
  return row ? rowToPlace(row) : null;
}

export function list(): Place[] {
  return query<PlaceRow>("SELECT * FROM places ORDER BY created_at DESC, rowid DESC").map(rowToPlace);
}

export function create(input: CreatePlaceInput): Place {
  const now = new Date().toISOString();
  const result = execute(
    `INSERT INTO places (name, category, address, rating, memo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.name,
    input.category,
    input.address ?? null,
    input.rating ?? null,
    input.memo ?? null,
    now,
    now,
  );
  const row = queryOne<PlaceRow>("SELECT * FROM places WHERE id = ?", result.lastInsertRowid);
  if (!row) throw new Error("Failed to create place");
  return rowToPlace(row);
}

export function update(id: number, input: UpdatePlaceInput): Place | null {
  const existing = queryOne<PlaceRow>("SELECT * FROM places WHERE id = ?", id);
  if (!existing) return null;

  const now = new Date().toISOString();
  execute(
    `UPDATE places SET name = ?, category = ?, address = ?, rating = ?, memo = ?, updated_at = ? WHERE id = ?`,
    input.name ?? existing.name,
    input.category ?? existing.category,
    "address" in input ? (input.address ?? null) : existing.address,
    "rating" in input ? (input.rating ?? null) : existing.rating,
    "memo" in input ? (input.memo ?? null) : existing.memo,
    now,
    id,
  );

  return getById(id);
}

export function listByUser(userId: number): Place[] {
  return query<PlaceRow>(
    `SELECT DISTINCT pl.* FROM places pl
     JOIN posts p ON p.place_id = pl.id
     WHERE p.user_id = ?
     ORDER BY pl.name ASC`,
    userId,
  ).map(rowToPlace);
}

export function remove(id: number): boolean {
  const result = execute("DELETE FROM places WHERE id = ?", id);
  return result.changes > 0;
}
