"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SeoBreakdown = {
  category: string;
  score: number;
  max: number;
  detail: string;
  tips: string[];
};

type SeoResult = {
  score: number;
  grade: string;
  breakdown: SeoBreakdown[];
};

export function SeoScoreCard({
  postId,
  lang,
  onError,
}: {
  postId: string;
  lang: "ko" | "en";
  onError?: (msg: string) => void;
}) {
  const [seoScore, setSeoScore] = useState<SeoResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFetch = async () => {
    setLoading(true);
    setSeoScore(null);
    try {
      const res = await fetch(`/api/posts/${postId}/seo-score?lang=${lang}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSeoScore(data);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "SEO 분석 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">SEO 점수</CardTitle>
          <Button variant="outline" size="sm" onClick={handleFetch} disabled={loading}>
            {loading ? "분석 중..." : seoScore ? "다시 분석" : "분석하기"}
          </Button>
        </div>
      </CardHeader>
      {seoScore && (
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "text-3xl font-bold w-16 h-16 rounded-full flex items-center justify-center border-2",
                seoScore.grade === "A" ? "border-green-500 text-green-400" :
                seoScore.grade === "B" ? "border-blue-500 text-blue-400" :
                seoScore.grade === "C" ? "border-yellow-500 text-yellow-400" :
                "border-red-500 text-red-400",
              )}
            >
              {seoScore.grade}
            </div>
            <div>
              <p className="text-2xl font-bold">{seoScore.score}점</p>
              <p className="text-xs text-[var(--text-muted)]">
                {seoScore.score >= 85 ? "훌륭합니다!" :
                 seoScore.score >= 70 ? "양호합니다" :
                 seoScore.score >= 50 ? "개선이 필요합니다" : "많은 개선이 필요합니다"}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {seoScore.breakdown.map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">{item.category}</span>
                  <span className="text-[var(--text-muted)]">{item.detail} ({item.score}/{item.max})</span>
                </div>
                <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      item.score / item.max >= 0.8 ? "bg-green-500" :
                      item.score / item.max >= 0.5 ? "bg-yellow-500" : "bg-red-500",
                    )}
                    style={{ width: `${(item.score / item.max) * 100}%` }}
                  />
                </div>
                {item.tips.length > 0 && (
                  <p className="text-xs text-[var(--text-muted)]">{item.tips[0]}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
