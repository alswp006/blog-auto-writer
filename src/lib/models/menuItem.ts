import { query, queryOne, execute } from "@/lib/db";
import { type MenuItemRow, type MenuItem, rowToMenuItem } from "@/lib/models/modelTypes";

export type CreateMenuItemInput = {
  placeId: number;
  name: string;
  priceKrw: number;
};

export type UpdateMenuItemInput = Partial<Pick<CreateMenuItemInput, "name" | "priceKrw">>;

export function getById(id: number): MenuItem | null {
  const row = queryOne<MenuItemRow>("SELECT * FROM menu_items WHERE id = ?", id);
  return row ? rowToMenuItem(row) : null;
}

export function listByPlace(placeId: number): MenuItem[] {
  return query<MenuItemRow>(
    "SELECT * FROM menu_items WHERE place_id = ? ORDER BY created_at ASC, rowid ASC",
    placeId,
  ).map(rowToMenuItem);
}

export function create(input: CreateMenuItemInput): MenuItem {
  const now = new Date().toISOString();
  const result = execute(
    `INSERT INTO menu_items (place_id, name, price_krw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    input.placeId,
    input.name,
    input.priceKrw,
    now,
    now,
  );
  const row = queryOne<MenuItemRow>("SELECT * FROM menu_items WHERE id = ?", result.lastInsertRowid);
  if (!row) throw new Error("Failed to create menu item");
  return rowToMenuItem(row);
}

export function update(id: number, input: UpdateMenuItemInput): MenuItem | null {
  const existing = queryOne<MenuItemRow>("SELECT * FROM menu_items WHERE id = ?", id);
  if (!existing) return null;

  const now = new Date().toISOString();
  execute(
    `UPDATE menu_items SET name = ?, price_krw = ?, updated_at = ? WHERE id = ?`,
    input.name ?? existing.name,
    input.priceKrw ?? existing.price_krw,
    now,
    id,
  );

  return getById(id);
}

export function remove(id: number): boolean {
  const result = execute("DELETE FROM menu_items WHERE id = ?", id);
  return result.changes > 0;
}
