// ── DB row types (snake_case, mirrors SQLite columns) ──────────────────────

export type UserProfileRow = {
  id: number;
  user_id: number;
  nickname: string;
  age_group: "20s" | "30s" | "40plus";
  preferred_tone: "casual" | "detailed";
  primary_platform: "naver" | "tistory" | "medium";
  created_at: string;
  updated_at: string;
};

export type StyleProfileRow = {
  id: number;
  user_id: number | null;
  name: string;
  is_system_preset: 0 | 1;
  sample_texts_json: string;
  analyzed_tone_json: string;
  created_at: string;
  updated_at: string;
};

// ── Application types (camelCase, used throughout the app) ──────────────────

export type AgeGroup = "20s" | "30s" | "40plus";
export type PreferredTone = "casual" | "detailed";
export type PrimaryPlatform = "naver" | "tistory" | "medium";

export type UserProfile = {
  id: number;
  userId: number;
  nickname: string;
  ageGroup: AgeGroup;
  preferredTone: PreferredTone;
  primaryPlatform: PrimaryPlatform;
  createdAt: string;
  updatedAt: string;
};

export type StyleProfile = {
  id: number;
  userId: number | null;
  name: string;
  isSystemPreset: boolean;
  sampleTexts: string[];
  analyzedTone: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

// ── Mapping helpers ─────────────────────────────────────────────────────────

export function rowToUserProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    userId: row.user_id,
    nickname: row.nickname,
    ageGroup: row.age_group,
    preferredTone: row.preferred_tone,
    primaryPlatform: row.primary_platform,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToStyleProfile(row: StyleProfileRow): StyleProfile {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    isSystemPreset: row.is_system_preset === 1,
    sampleTexts: JSON.parse(row.sample_texts_json) as string[],
    analyzedTone: JSON.parse(row.analyzed_tone_json) as Record<string, string>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
