"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Platform = "naver" | "tistory" | "medium";
type Lang = "ko" | "en";

type PostVariant = {
  id: number;
  postId: number;
  platform: Platform;
  lang: Lang;
  title: string;
  content: string;
  hashtags: string[];
  createdAt: string;
  updatedAt: string;
};

const PLATFORM_INFO: Record<Platform, { label: string; color: string }> = {
  naver: { label: "네이버", color: "text-green-400" },
  tistory: { label: "티스토리", color: "text-orange-400" },
  medium: { label: "Medium", color: "text-neutral-300" },
};

export function PlatformOptimizeCard({
  postId,
  lang,
  variants,
  onOptimized,
  onToast,
}: {
  postId: string;
  lang: Lang;
  variants: PostVariant[];
  onOptimized: (variant: PostVariant) => void;
  onToast: (msg: string) => void;
}) {
  const [optimizing, setOptimizing] = useState<Platform | null>(null);

  const handleOptimize = async (platform: Platform) => {
    setOptimizing(platform);
    try {
      const res = await fetch(`/api/posts/${postId}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "최적화 실패");
      onOptimized(data.variant);
      onToast(`${PLATFORM_INFO[platform].label} SEO 최적화 완료!`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "최적화 실패");
    } finally {
      setOptimizing(null);
    }
  };

  const getVariant = (platform: Platform): PostVariant | undefined =>
    variants.find((v) => v.platform === platform && v.lang === lang);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">플랫폼 SEO 최적화</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-[var(--text-muted)]">
          AI가 각 플랫폼의 SEO 전략에 맞게 글을 리라이팅합니다. 원본은 유지됩니다.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["naver", "tistory", "medium"] as Platform[]).map((platform) => {
            const info = PLATFORM_INFO[platform];
            const variant = getVariant(platform);
            const isOptimizing = optimizing === platform;

            return (
              <div key={platform} className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOptimize(platform)}
                  disabled={optimizing !== null}
                  className="w-full"
                >
                  {isOptimizing ? "최적화 중..." : `${info.label} 최적화`}
                </Button>
                {variant && (
                  <div className="flex items-center gap-1.5 justify-center">
                    <Badge variant="outline" className={`text-[10px] ${info.color}`}>
                      완료
                    </Badge>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {new Date(variant.updatedAt).toLocaleDateString("ko-KR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
