export type Post = {
  id: number;
  titleKo: string | null;
  contentKo: string | null;
  hashtagsKo: string[];
  titleEn: string | null;
  contentEn: string | null;
  hashtagsEn: string[];
  status: string;
  generationError: string | null;
  placeId: number;
  scheduledAt: string | null;
  scheduledPlatform: string | null;
  scheduledLang: string | null;
};

export type Photo = {
  id: number;
  filePath: string;
  caption: string | null;
  altText: string | null;
  orderIndex: number;
};

export type Place = {
  id: number;
  name: string;
  category: string;
};

export type PublishHistoryItem = {
  id: number;
  postId: number;
  platform: string;
  lang: string;
  publishedUrl: string | null;
  status: "published" | "failed" | "copied";
  error: string | null;
  publishedAt: string;
};

export type Tab = "preview" | "edit";
export type Lang = "ko" | "en";
export type Platform = "naver" | "tistory" | "medium" | "wordpress";

export const PLATFORM_LABELS: Record<Platform, string> = {
  naver: "네이버",
  tistory: "티스토리",
  medium: "Medium",
  wordpress: "WordPress",
};

export const PLATFORM_COLORS: Record<string, string> = {
  naver: "bg-green-500/15 text-green-400 border-green-500/30",
  tistory: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-white/15 text-white border-white/30",
  wordpress: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};
