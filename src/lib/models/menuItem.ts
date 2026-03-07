import { query, queryOne, execute } from "@/lib/db";
import { type MenuItemRow, type MenuItem, rowToMenuItem } from "@/lib/models/modelTypes";

export type CreateMenuItemInput = {
  placeId: number;
  name: string;
  priceKrw: number;
};

export type UpdateMenuItemInput = Partial<Pick<CreateMenuItemInput, "name" | "priceKrw">>;

export async function getById(id: number): Promise<MenuItem | null> {
  const row = await queryOne<MenuItemRow>("SELECT * FROM menu_items WHERE id = ?", id);
  return row ? rowToMenuItem(row) : null;
}

export async function listByPlace(placeId: number): Promise<MenuItem[]> {
  return (await query<MenuItemRow>(
    "SELECT * FROM menu_items WHERE place_id = ? ORDER BY created_at ASC, rowid ASC",
    placeId,
  )).map(rowToMenuItem);
}

export async function create(input: CreateMenuItemInput): Promise<MenuItem> {
  const now = new Date().toISOString();
  const result = await execute(
    `INSERT INTO menu_items (place_id, name, price_krw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    input.placeId,
    input.name,
    input.priceKrw,
    now,
    now,
  );
  const row = await queryOne<MenuItemRow>("SELECT * FROM menu_items WHERE id = ?", result.lastInsertRowid);
  if (!row) throw new Error("Failed to create menu item");
  return rowToMenuItem(row);
}

export async function update(id: number, input: UpdateMenuItemInput): Promise<MenuItem | null> {
  const existing = await queryOne<MenuItemRow>("SELECT * FROM menu_items WHERE id = ?", id);
  if (!existing) return null;

  const now = new Date().toISOString();
  await execute(
    `UPDATE menu_items SET name = ?, price_krw = ?, updated_at = ? WHERE id = ?`,
    input.name ?? existing.name,
    input.priceKrw ?? existing.price_krw,
    now,
    id,
  );

  return await getById(id);
}

export async function remove(id: number): Promise<boolean> {
  const result = await execute("DELETE FROM menu_items WHERE id = ?", id);
  return result.changes > 0;
}
