import { queryOne, execute } from "@/lib/db";
import {
  type UserProfileRow,
  type UserProfile,
  type AgeGroup,
  type PreferredTone,
  type PrimaryPlatform,
  type WatermarkPosition,
  rowToUserProfile,
} from "@/lib/models/modelTypes";

export type CreateUserProfileInput = {
  userId: number;
  nickname: string;
  ageGroup: AgeGroup;
  preferredTone: PreferredTone;
  primaryPlatform: PrimaryPlatform;
  watermarkText?: string | null;
  watermarkPosition?: WatermarkPosition;
};

export type UpdateUserProfileInput = Partial<Omit<CreateUserProfileInput, "userId">>;

export function getByUserId(userId: number): UserProfile | null {
  const row = queryOne<UserProfileRow>(
    "SELECT * FROM user_profiles WHERE user_id = ?",
    userId,
  );
  return row ? rowToUserProfile(row) : null;
}

export function create(input: CreateUserProfileInput): UserProfile {
  const now = new Date().toISOString();
  const result = execute(
    `INSERT INTO user_profiles (user_id, nickname, age_group, preferred_tone, primary_platform, watermark_text, watermark_position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.userId,
    input.nickname,
    input.ageGroup,
    input.preferredTone,
    input.primaryPlatform,
    input.watermarkText ?? null,
    input.watermarkPosition ?? "bottom-right",
    now,
    now,
  );
  const row = queryOne<UserProfileRow>(
    "SELECT * FROM user_profiles WHERE id = ?",
    result.lastInsertRowid,
  );
  if (!row) throw new Error("Failed to create user profile");
  return rowToUserProfile(row);
}

export function update(userId: number, input: UpdateUserProfileInput): UserProfile | null {
  const existing = queryOne<UserProfileRow>(
    "SELECT * FROM user_profiles WHERE user_id = ?",
    userId,
  );
  if (!existing) return null;

  const now = new Date().toISOString();
  execute(
    `UPDATE user_profiles
     SET nickname = ?, age_group = ?, preferred_tone = ?, primary_platform = ?,
         watermark_text = ?, watermark_position = ?, updated_at = ?
     WHERE user_id = ?`,
    input.nickname ?? existing.nickname,
    input.ageGroup ?? existing.age_group,
    input.preferredTone ?? existing.preferred_tone,
    input.primaryPlatform ?? existing.primary_platform,
    input.watermarkText !== undefined ? input.watermarkText : existing.watermark_text,
    input.watermarkPosition ?? existing.watermark_position,
    now,
    userId,
  );

  return getByUserId(userId);
}
