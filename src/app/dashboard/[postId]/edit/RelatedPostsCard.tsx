"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lang } from "./types";

type RelatedPost = {
  id: number;
  titleKo: string | null;
  titleEn: string | null;
  placeName: string;
  placeCategory: string;
};

type Props = {
  postId: string;
  lang: Lang;
  onInsertLink: (text: string) => void;
  showToast: (msg: string) => void;
};

export function RelatedPostsCard({ postId, lang, onInsertLink, showToast }: Props) {
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([]);
  const [loading, setLoading] = useState(false);

  const handleLoad = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/related`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setRelatedPosts(data.related ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "관련 글 로드 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">관련 글 추천</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoad}
            disabled={loading}
            className="text-xs"
          >
            {loading ? "검색 중..." : "관련 글 찾기"}
          </Button>
        </div>
      </CardHeader>
      {relatedPosts.length > 0 && (
        <CardContent className="space-y-2">
          <p className="text-xs text-[var(--text-muted)]">같은 카테고리/지역의 내 글 — 본문에 내부 링크로 활용하세요</p>
          {relatedPosts.map((rp) => (
            <div key={rp.id} className="flex items-center gap-2 py-1.5 border-b border-[var(--border)] last:border-0">
              <div className="min-w-0 flex-1">
                <Link href={`/dashboard/${rp.id}/edit`} className="text-xs text-[var(--accent)] hover:underline truncate block">
                  {rp.titleKo ?? rp.placeName}
                </Link>
                <p className="text-xs text-[var(--text-muted)]">{rp.placeName}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const linkText = lang === "ko"
                    ? `\n\n👉 이 근처 다른 곳도 다녀왔어요: ${rp.titleKo ?? rp.placeName}`
                    : `\n\n👉 Also nearby: ${rp.titleEn ?? rp.placeName}`;
                  onInsertLink(linkText);
                  showToast("관련 글 링크가 본문 끝에 추가되었습니다. 저장해주세요.");
                }}
                className="text-xs h-9 min-h-[44px] px-3 shrink-0"
              >
                삽입
              </Button>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
