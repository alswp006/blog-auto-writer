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

export function getSystemPresets(): StyleProfile[] {
  const rows = query<StyleProfileRow>(
    "SELECT * FROM style_profiles WHERE is_system_preset = 1",
  );
  return rows.map(rowToStyleProfile);
}

export function getByUserId(userId: number): StyleProfile[] {
  const rows = query<StyleProfileRow>(
    "SELECT * FROM style_profiles WHERE user_id = ? AND is_system_preset = 0",
    userId,
  );
  return rows.map(rowToStyleProfile);
}

export function getById(id: number): StyleProfile | null {
  const row = queryOne<StyleProfileRow>(
    "SELECT * FROM style_profiles WHERE id = ?",
    id,
  );
  return row ? rowToStyleProfile(row) : null;
}

export function create(input: CreateStyleProfileInput): StyleProfile {
  const now = new Date().toISOString();
  const result = execute(
    `INSERT INTO style_profiles (user_id, name, is_system_preset, sample_texts_json, analyzed_tone_json, created_at, updated_at)
     VALUES (?, ?, 0, ?, ?, ?, ?)`,
    input.userId,
    input.name,
    JSON.stringify(input.sampleTexts),
    JSON.stringify(input.analyzedTone),
    now,
    now,
  );
  const row = queryOne<StyleProfileRow>(
    "SELECT * FROM style_profiles WHERE id = ?",
    result.lastInsertRowid,
  );
  if (!row) throw new Error("Failed to create style profile");
  return rowToStyleProfile(row);
}
