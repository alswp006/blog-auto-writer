// ── DB row types (snake_case, mirrors SQLite columns) ──────────────────────

export type PlaceRow = {
  id: number;
  user_id: number | null;
  name: string;
  category: "restaurant" | "cafe" | "accommodation" | "attraction";
  address: string | null;
  rating: number | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type MenuItemRow = {
  id: number;
  place_id: number;
  name: string;
  price_krw: number;
  created_at: string;
  updated_at: string;
};

export type PhotoRow = {
  id: number;
  place_id: number;
  file_path: string;
  caption: string | null;
  alt_text: string | null;
  order_index: number;
  created_at: string;
};



export type WatermarkPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export type UserProfileRow = {
  id: number;
  user_id: number;
  nickname: string;
  age_group: "20s" | "30s" | "40plus";
  preferred_tone: "casual" | "detailed";
  primary_platform: "naver" | "tistory" | "medium";
  watermark_text: string | null;
  watermark_position: WatermarkPosition;
  created_at: string;
  updated_at: string;
};

export type StyleProfileRow = {
  id: number;
  user_id: number | null;
  name: string;
  description: string | null;
  is_system_preset: 0 | 1;
  sample_texts_json: string;
  analyzed_tone_json: string;
  created_at: string;
  updated_at: string;
};

// ── Application types (camelCase, used throughout the app) ──────────────────

export type PlaceCategory = "restaurant" | "cafe" | "accommodation" | "attraction";

export type Place = {
  id: number;
  userId: number | null;
  name: string;
  category: PlaceCategory;
  address: string | null;
  rating: number | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MenuItem = {
  id: number;
  placeId: number;
  name: string;
  priceKrw: number;
  createdAt: string;
  updatedAt: string;
};

export type Photo = {
  id: number;
  placeId: number;
  filePath: string;
  caption: string | null;
  altText: string | null;
  orderIndex: number;
  createdAt: string;
};

export function rowToPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    name: row.name,
    category: row.category,
    address: row.address,
    rating: row.rating,
    memo: row.memo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToMenuItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    placeId: row.place_id,
    name: row.name,
    priceKrw: row.price_krw,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    placeId: row.place_id,
    filePath: row.file_path,
    caption: row.caption,
    altText: row.alt_text ?? null,
    orderIndex: row.order_index,
    createdAt: row.created_at,
  };
}



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
  watermarkText: string | null;
  watermarkPosition: WatermarkPosition;
  createdAt: string;
  updatedAt: string;
};

export type StyleProfile = {
  id: number;
  userId: number | null;
  name: string;
  description: string | null;
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
    watermarkText: row.watermark_text,
    watermarkPosition: row.watermark_position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToStyleProfile(row: StyleProfileRow): StyleProfile {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? null,
    isSystemPreset: row.is_system_preset === 1,
    sampleTexts: JSON.parse(row.sample_texts_json) as string[],
    analyzedTone: JSON.parse(row.analyzed_tone_json) as Record<string, string>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
