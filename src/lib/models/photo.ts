import { query, queryOne, execute } from "@/lib/db";
import { type PhotoRow, type Photo, rowToPhoto } from "@/lib/models/modelTypes";

export type CreatePhotoInput = {
  placeId: number;
  filePath: string;
  caption?: string | null;
  orderIndex: number;
};

export type UpdatePhotoInput = Partial<Pick<CreatePhotoInput, "filePath" | "caption" | "orderIndex">>;

export function getById(id: number): Photo | null {
  const row = queryOne<PhotoRow>("SELECT * FROM photos WHERE id = ?", id);
  return row ? rowToPhoto(row) : null;
}

export function listPhotos(placeId: number): Photo[] {
  return query<PhotoRow>(
    "SELECT * FROM photos WHERE place_id = ? ORDER BY order_index ASC, rowid ASC",
    placeId,
  ).map(rowToPhoto);
}

export function create(input: CreatePhotoInput): Photo {
  const now = new Date().toISOString();
  const result = execute(
    `INSERT INTO photos (place_id, file_path, caption, order_index, created_at) VALUES (?, ?, ?, ?, ?)`,
    input.placeId,
    input.filePath,
    input.caption ?? null,
    input.orderIndex,
    now,
  );
  const row = queryOne<PhotoRow>("SELECT * FROM photos WHERE id = ?", result.lastInsertRowid);
  if (!row) throw new Error("Failed to create photo");
  return rowToPhoto(row);
}

export function update(id: number, input: UpdatePhotoInput): Photo | null {
  const existing = queryOne<PhotoRow>("SELECT * FROM photos WHERE id = ?", id);
  if (!existing) return null;

  execute(
    `UPDATE photos SET file_path = ?, caption = ?, order_index = ? WHERE id = ?`,
    input.filePath ?? existing.file_path,
    "caption" in input ? (input.caption ?? null) : existing.caption,
    input.orderIndex ?? existing.order_index,
    id,
  );

  return getById(id);
}

export function remove(id: number): boolean {
  const result = execute("DELETE FROM photos WHERE id = ?", id);
  return result.changes > 0;
}
