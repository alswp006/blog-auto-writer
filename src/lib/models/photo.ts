import { query, queryOne, execute } from "@/lib/db";
import { type PhotoRow, type Photo, rowToPhoto } from "@/lib/models/modelTypes";

export type CreatePhotoInput = {
  placeId: number;
  filePath: string;
  caption?: string | null;
  orderIndex: number;
};

export type UpdatePhotoInput = Partial<Pick<CreatePhotoInput, "filePath" | "caption" | "orderIndex">>;

export async function getById(id: number): Promise<Photo | null> {
  const row = await queryOne<PhotoRow>("SELECT * FROM photos WHERE id = ?", id);
  return row ? rowToPhoto(row) : null;
}

export async function listPhotos(placeId: number): Promise<Photo[]> {
  return (await query<PhotoRow>(
    "SELECT * FROM photos WHERE place_id = ? ORDER BY order_index ASC, rowid ASC",
    placeId,
  )).map(rowToPhoto);
}

export async function create(input: CreatePhotoInput): Promise<Photo> {
  const now = new Date().toISOString();
  const result = await execute(
    `INSERT INTO photos (place_id, file_path, caption, order_index, created_at) VALUES (?, ?, ?, ?, ?)`,
    input.placeId,
    input.filePath,
    input.caption ?? null,
    input.orderIndex,
    now,
  );
  const row = await queryOne<PhotoRow>("SELECT * FROM photos WHERE id = ?", result.lastInsertRowid);
  if (!row) throw new Error("Failed to create photo");
  return rowToPhoto(row);
}

export async function update(id: number, input: UpdatePhotoInput): Promise<Photo | null> {
  const existing = await queryOne<PhotoRow>("SELECT * FROM photos WHERE id = ?", id);
  if (!existing) return null;

  await execute(
    `UPDATE photos SET file_path = ?, caption = ?, order_index = ? WHERE id = ?`,
    input.filePath ?? existing.file_path,
    "caption" in input ? (input.caption ?? null) : existing.caption,
    input.orderIndex ?? existing.order_index,
    id,
  );

  return await getById(id);
}

export async function updateFilePath(id: number, filePath: string): Promise<void> {
  await execute("UPDATE photos SET file_path = ? WHERE id = ?", filePath, id);
}

export async function remove(id: number): Promise<boolean> {
  const result = await execute("DELETE FROM photos WHERE id = ?", id);
  return result.changes > 0;
}
