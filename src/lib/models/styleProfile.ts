import { query, queryOne, execute } from "@/lib/db";
import {
  type StyleProfileRow,
  type StyleProfile,
  rowToStyleProfile,
} from "@/lib/models/modelTypes";

export type CreateStyleProfileInput = {
  userId: number;
  name: string;
  sampleTexts: string[];
  analyzedTone: Record<string, string>;
};

export async function getSystemPresets(): Promise<StyleProfile[]> {
  const rows = await query<StyleProfileRow>(
    "SELECT * FROM style_profiles WHERE is_system_preset = 1",
  );
  return rows.map(rowToStyleProfile);
}

export async function getByUserId(userId: number): Promise<StyleProfile[]> {
  const rows = await query<StyleProfileRow>(
    "SELECT * FROM style_profiles WHERE user_id = ? AND is_system_preset = 0",
    userId,
  );
  return rows.map(rowToStyleProfile);
}

export async function getById(id: number): Promise<StyleProfile | null> {
  const row = await queryOne<StyleProfileRow>(
    "SELECT * FROM style_profiles WHERE id = ?",
    id,
  );
  return row ? rowToStyleProfile(row) : null;
}

export async function create(input: CreateStyleProfileInput): Promise<StyleProfile> {
  const now = new Date().toISOString();
  const result = await execute(
    `INSERT INTO style_profiles (user_id, name, is_system_preset, sample_texts_json, analyzed_tone_json, created_at, updated_at)
     VALUES (?, ?, 0, ?, ?, ?, ?)`,
    input.userId,
    input.name,
    JSON.stringify(input.sampleTexts),
    JSON.stringify(input.analyzedTone),
    now,
    now,
  );
  const row = await queryOne<StyleProfileRow>(
    "SELECT * FROM style_profiles WHERE id = ?",
    result.lastInsertRowid,
  );
  if (!row) throw new Error("Failed to create style profile");
  return rowToStyleProfile(row);
}
