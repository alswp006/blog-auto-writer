"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Heart, MessageCircle, TrendingUp, TrendingDown } from "lucide-react";

type DailyRevenue = {
  date: string;
  earnings: number;
  clicks: number;
  impressions: number;
};

type TopPost = {
  postId: number;
  titleKo: string | null;
  placeName: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  fetchedAt: string;
};

const PLATFORM_LABELS: Record<string, string> = {
  tistory: "티스토리",
  medium: "Medium",
  wordpress: "WordPress",
  naver: "네이버",
};

export default function AnalyticsPage() {
  const [revenueConfigured, setRevenueConfigured] = useState(false);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [daily, setDaily] = useState<DailyRevenue[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/analytics/revenue")
        .then((r) => (r.ok ? r.json() : { configured: false }))
        .then((data) => {
          setRevenueConfigured(data.configured ?? false);
          setRevenueError(data.error ?? null);
          setDaily(data.daily ?? []);
          setMonthTotal(data.monthTotal ?? 0);
        }),
      fetch("/api/analytics/posts")
        .then((r) => (r.ok ? r.json() : { topPosts: [] }))
        .then((data) => setTopPosts(data.topPosts ?? [])),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRefreshStats = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/analytics/posts", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setTopPosts(data.topPosts ?? []);
        showToast(`통계 업데이트 완료! (${data.updated}건)`);
      }
    } catch {
      showToast("통계 업데이트 실패");
    } finally {
      setRefreshing(false);
    }
  };

  // Filter daily data by period
  const filteredDaily = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    return daily.filter((d) => new Date(d.date) >= cutoff);
  }, [daily, period]);

  const maxEarnings = Math.max(...filteredDaily.map((d) => d.earnings), 1);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-[var(--bg-elevated)] rounded w-40" />
          <div className="h-48 bg-[var(--bg-elevated)] rounded" />
          <div className="h-64 bg-[var(--bg-elevated)] rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[var(--bg-elevated)] border border-[var(--border)] text-sm px-5 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">분석</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">수익 및 글 성과 분석</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard" className="no-underline">Dashboard</Link>
        </Button>
      </div>

      {/* Revenue Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">수익 현황</h2>
        {!revenueConfigured ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">애드센스 연동 가이드</CardTitle>
              <CardDescription>수익 데이터를 확인하려면 Google AdSense를 연동하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                <ol className="text-sm text-[var(--text-muted)] space-y-2 list-decimal list-inside">
                  <li>
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] hover:underline"
                    >
                      Google Cloud Console
                    </a>
                    에서 OAuth 2.0 클라이언트 생성
                  </li>
                  <li>AdSense Management API 활성화</li>
                  <li>Refresh Token 발급 (OAuth Playground 활용)</li>
                  <li>환경변수 설정:
                    <code className="block mt-1 text-xs bg-[var(--bg-card)] px-2 py-1 rounded font-mono">
                      GOOGLE_ADSENSE_CLIENT_ID, GOOGLE_ADSENSE_CLIENT_SECRET, GOOGLE_ADSENSE_REFRESH_TOKEN
                    </code>
                  </li>
                </ol>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { title: "네이버 애드포스트", href: "https://adpost.naver.com/" },
                  { title: "구글 애드센스", href: "https://www.google.com/adsense/start/" },
                  { title: "Medium Partner", href: "https://medium.com/earn" },
                ].map((link) => (
                  <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="no-underline">
                    <Card className="hover:border-[var(--border-hover)] transition-colors">
                      <CardContent className="p-3">
                        <p className="text-sm font-medium text-[var(--text)]">{link.title}</p>
                        <span className="text-xs text-[var(--accent)]">바로가기 &rarr;</span>
                      </CardContent>
                    </Card>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : revenueError ? (
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-red-400">수익 데이터 로드 실패: {revenueError}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Month total */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-[var(--text-muted)] mb-1">이번 달 총 수익</p>
                  <p className="text-3xl font-bold">
                    ${monthTotal.toFixed(2)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-[var(--text-muted)] mb-1">총 클릭</p>
                  <p className="text-3xl font-bold">
                    {daily.reduce((s, d) => s + d.clicks, 0).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-[var(--text-muted)] mb-1">총 노출</p>
                  <p className="text-3xl font-bold">
                    {daily.reduce((s, d) => s + d.impressions, 0).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Daily chart — SVG bar chart with period filter */}
            {daily.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">일별 수익</CardTitle>
                    <div className="flex gap-1">
                      {([7, 30, 90] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPeriod(p)}
                          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                            period === p
                              ? "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30"
                              : "text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-hover)]"
                          }`}
                        >
                          {p}일
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredDaily.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)] text-center py-8">해당 기간에 수익 데이터가 없습니다.</p>
                  ) : (
                    <svg viewBox={`0 0 ${filteredDaily.length * 32} 160`} className="w-full h-40" preserveAspectRatio="none">
                      {filteredDaily.map((d, i) => {
                        const barH = Math.max(2, (d.earnings / maxEarnings) * 130);
                        const x = i * 32 + 4;
                        return (
                          <g key={d.date}>
                            <rect
                              x={x}
                              y={140 - barH}
                              width={24}
                              height={barH}
                              rx={3}
                              className="fill-[var(--accent)] opacity-80 hover:opacity-100 transition-opacity"
                            />
                            <title>{`${d.date}: $${d.earnings.toFixed(2)}`}</title>
                            <text
                              x={x + 12}
                              y={155}
                              textAnchor="middle"
                              className="fill-[var(--text-muted)] text-[8px]"
                              fontSize="8"
                            >
                              {d.date.slice(8)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Popular Posts Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">인기글 분석</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshStats}
            disabled={refreshing}
          >
            {refreshing ? "업데이트 중..." : "통계 새로고침"}
          </Button>
        </div>

        {topPosts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-[var(--text-muted)] mb-2">아직 수집된 통계가 없습니다.</p>
              <p className="text-xs text-[var(--text-muted)]">
                글을 발행한 후 &quot;통계 새로고침&quot; 버튼을 클릭하여<br />
                티스토리 등 플랫폼에서 조회수를 수집합니다.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {topPosts.map((post, idx) => (
              <Card key={`${post.postId}-${post.platform}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-[var(--text-muted)] w-6 text-center">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/dashboard/${post.postId}/edit`}
                        className="no-underline block group"
                      >
                        <p className="text-sm font-medium truncate group-hover:text-[var(--accent)] transition-colors">
                          {post.titleKo ?? "(제목 없음)"}
                        </p>
                      </Link>
                      <p className="text-xs text-[var(--text-muted)]">{post.placeName}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {PLATFORM_LABELS[post.platform] ?? post.platform}
                    </Badge>
                    <div className="flex gap-3 text-xs text-[var(--text-secondary)] shrink-0">
                      <span className="flex items-center gap-1" title="조회수"><Eye className="w-3 h-3" /> {post.views.toLocaleString()}</span>
                      <span className="flex items-center gap-1" title="좋아요"><Heart className="w-3 h-3" /> {post.likes}</span>
                      <span className="flex items-center gap-1" title="댓글"><MessageCircle className="w-3 h-3" /> {post.comments}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
