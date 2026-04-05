"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Lang } from "./types";

type CompetitorData = {
  benchmarks: { avgContentLength: string; avgPhotoCount: string; commonElements: string[] };
  missing: string[];
  strengths: string[];
  improvements: string[];
  competitiveScore: number;
};

type Props = {
  postId: string;
  lang: Lang;
  showToast: (msg: string) => void;
};

export function CompetitorAnalysisCard({ postId, lang, showToast }: Props) {
  const [competitors, setCompetitors] = useState<CompetitorData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFetch = async () => {
    setLoading(true);
    setCompetitors(null);
    try {
      const res = await fetch(`/api/posts/${postId}/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setCompetitors(data.analysis);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "경쟁 분석 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">경쟁 글 분석</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFetch}
            disabled={loading}
          >
            {loading ? "분석 중..." : competitors ? "다시 분석" : "분석하기"}
          </Button>
        </div>
      </CardHeader>
      {competitors && (
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "text-2xl font-bold w-12 h-12 rounded-full flex items-center justify-center border-2",
              competitors.competitiveScore >= 8 ? "border-green-500 text-green-400" :
              competitors.competitiveScore >= 6 ? "border-blue-500 text-blue-400" :
              competitors.competitiveScore >= 4 ? "border-yellow-500 text-yellow-400" :
              "border-red-500 text-red-400",
            )}>
              {competitors.competitiveScore}
            </div>
            <div>
              <p className="text-sm font-medium">경쟁력 점수</p>
              <p className="text-xs text-[var(--text-muted)]">상위 글 대비 10점 만점</p>
            </div>
          </div>

          <div className="rounded-lg bg-[var(--bg-elevated)] p-3 space-y-1.5">
            <p className="text-xs font-medium">상위 글 기준</p>
            <p className="text-xs text-[var(--text-secondary)]">
              평균 글자수: {competitors.benchmarks.avgContentLength} | 평균 사진: {competitors.benchmarks.avgPhotoCount}
            </p>
            {competitors.benchmarks.commonElements.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {competitors.benchmarks.commonElements.map((el, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{el}</Badge>
                ))}
              </div>
            )}
          </div>

          {competitors.strengths.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-green-400">강점</p>
              {competitors.strengths.map((s, i) => (
                <p key={i} className="text-xs text-[var(--text-secondary)] pl-2 border-l-2 border-green-500/30">{s}</p>
              ))}
            </div>
          )}

          {competitors.missing.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-yellow-400">부족한 요소</p>
              {competitors.missing.map((m, i) => (
                <p key={i} className="text-xs text-[var(--text-secondary)] pl-2 border-l-2 border-yellow-500/30">{m}</p>
              ))}
            </div>
          )}

          {competitors.improvements.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--accent)]">개선 제안</p>
              {competitors.improvements.map((imp, i) => (
                <p key={i} className="text-xs text-[var(--text-secondary)] pl-2 border-l-2 border-[var(--accent)]/30">{imp}</p>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
