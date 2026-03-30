"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Platform = "naver" | "tistory" | "medium" | "wordpress";

const PLATFORM_LABELS: Record<Platform, string> = {
  naver: "네이버",
  tistory: "티스토리",
  medium: "Medium",
  wordpress: "WordPress",
};

const PLATFORM_COLORS: Record<string, string> = {
  naver: "bg-green-500/15 text-green-400 border-green-500/30",
  tistory: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-white/15 text-white border-white/30",
  wordpress: "bg-blue-500/15 text-blue-400 border-blue-500/30",
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

export function PublishHistoryCard({ history }: { history: PublishHistoryItem[] }) {
  if (history.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">발행 이력</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2">
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("text-xs border", PLATFORM_COLORS[h.platform] ?? "")}>
                  {PLATFORM_LABELS[h.platform as Platform] ?? h.platform}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {h.lang === "ko" ? "한국어" : "English"}
                </Badge>
                {h.status === "published" && <span className="text-xs text-green-400">발행됨</span>}
                {h.status === "copied" && <span className="text-xs text-blue-400">복사됨</span>}
                {h.status === "failed" && <span className="text-xs text-red-400">실패</span>}
              </div>
              <div className="flex items-center gap-2">
                {h.publishedUrl && (
                  <a href={h.publishedUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-[var(--accent)] hover:underline">
                    열기
                  </a>
                )}
                <span className="text-xs text-[var(--text-muted)]">
                  {new Date(h.publishedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
