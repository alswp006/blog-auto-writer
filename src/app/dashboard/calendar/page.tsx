"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

type CalendarPost = {
  id: number;
  titleKo: string | null;
  titleEn: string | null;
  status: string;
  createdAt: string;
  scheduledAt: string | null;
  scheduledPlatform: string | null;
  placeName: string | null;
  placeCategory: string | null;
  thumbnailPath: string | null;
};

type Publish = {
  postId: number;
  platform: string;
  status: string;
  publishedAt: string;
};

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_NAMES = [
  "", "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽", cafe: "☕", accommodation: "🏨", attraction: "🏛",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  generated: "bg-green-500/15 text-green-400 border-green-500/30",
  scheduled: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const CATEGORY_LABEL: Record<string, string> = {
  restaurant: "맛집", cafe: "카페", accommodation: "숙소", attraction: "여행지",
};

export default function CalendarPage() {
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [publishes, setPublishes] = useState<Publish[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/calendar?year=${year}&month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts ?? []);
        setPublishes(data.publishes ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // Group posts and publishes by day
  const safeDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };
  const getDay = (dateStr: string) => safeDate(dateStr)?.getDate() ?? 0;
  const getMonth = (dateStr: string) => (safeDate(dateStr)?.getMonth() ?? -1) + 1;
  const getYear = (dateStr: string) => safeDate(dateStr)?.getFullYear() ?? 0;
  const isThisMonth = (dateStr: string) => getYear(dateStr) === year && getMonth(dateStr) === month;

  const filteredPosts = categoryFilter === "all" ? posts : posts.filter((p) => p.placeCategory === categoryFilter);

  const postsByDay = new Map<number, CalendarPost[]>();
  for (const post of filteredPosts) {
    const day = isThisMonth(post.createdAt) ? getDay(post.createdAt) : null;
    const schedDay = post.scheduledAt && isThisMonth(post.scheduledAt) ? getDay(post.scheduledAt) : null;
    if (day) {
      if (!postsByDay.has(day)) postsByDay.set(day, []);
      postsByDay.get(day)!.push(post);
    }
    if (schedDay && schedDay !== day) {
      if (!postsByDay.has(schedDay)) postsByDay.set(schedDay, []);
      postsByDay.get(schedDay)!.push({ ...post, status: "scheduled" });
    }
  }

  const publishesByDay = new Map<number, Publish[]>();
  for (const pub of publishes) {
    if (isThisMonth(pub.publishedAt)) {
      const day = getDay(pub.publishedAt);
      if (!publishesByDay.has(day)) publishesByDay.set(day, []);
      publishesByDay.get(day)!.push(pub);
    }
  }

  const todayDay = today.getFullYear() === year && today.getMonth() + 1 === month ? today.getDate() : null;

  // Stats
  const totalPosts = filteredPosts.length;
  const generatedPosts = filteredPosts.filter((p) => p.status === "generated").length;
  const publishedCount = publishes.filter((p) => p.status === "published" || p.status === "copied").length;

  return (
    <section className="w-full py-12">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">콘텐츠 캘린더</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              글 작성과 발행 일정을 한눈에
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard" className="no-underline">대시보드</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{totalPosts}</p>
              <p className="text-xs text-[var(--text-muted)]">이번 달 글</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{generatedPosts}</p>
              <p className="text-xs text-[var(--text-muted)]">생성 완료</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{publishedCount}</p>
              <p className="text-xs text-[var(--text-muted)]">발행됨</p>
            </CardContent>
          </Card>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          {["all", "restaurant", "cafe", "accommodation", "attraction"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                categoryFilter === cat
                  ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-hover)]"
              }`}
            >
              {cat === "all" ? "전체" : `${CATEGORY_EMOJI[cat] ?? ""} ${CATEGORY_LABEL[cat] ?? cat}`}
            </button>
          ))}
        </div>

        {/* Calendar — desktop grid, mobile list */}
        {/* Mobile list view */}
        <div className="md:hidden space-y-2">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dayPosts = postsByDay.get(day) ?? [];
            if (dayPosts.length === 0) return null;
            const isToday = day === todayDay;
            return (
              <Card key={day} className={isToday ? "border-[var(--accent)]/30" : ""}>
                <CardContent className="p-3">
                  <p className={cn("text-xs font-medium mb-2", isToday && "text-[var(--accent)]")}>
                    {month}월 {day}일 {DAYS_KO[new Date(year, month - 1, day).getDay()]}요일
                    {isToday && <Badge variant="secondary" className="ml-2 text-[9px]">오늘</Badge>}
                  </p>
                  <div className="space-y-1">
                    {dayPosts.map((post, j) => (
                      <Link key={`${post.id}-${j}`} href={`/dashboard/${post.id}/edit`} className="no-underline block">
                        <div className={cn(
                          "text-xs px-2 py-1.5 rounded border flex items-center gap-2",
                          STATUS_COLORS[post.status] ?? STATUS_COLORS.draft,
                        )}>
                          <span>{CATEGORY_EMOJI[post.placeCategory ?? ""] ?? ""}</span>
                          <span className="truncate">{post.placeName ?? "글"}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          }).filter(Boolean)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).every((day) => (postsByDay.get(day) ?? []).length === 0) && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-[var(--text-muted)]">이번 달에 작성한 글이 없습니다.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Desktop calendar grid */}
        <Card className="hidden md:block">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={prevMonth}>&lt;</Button>
              <CardTitle className="text-lg">{year}년 {MONTH_NAMES[month]}</CardTitle>
              <Button variant="ghost" size="sm" onClick={nextMonth}>&gt;</Button>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            {loading ? (
              <div className="h-64 flex items-center justify-center text-sm text-[var(--text-muted)]">
                로딩 중...
              </div>
            ) : (
              <>
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                  {DAYS_KO.map((d) => (
                    <div key={d} className={cn(
                      "text-center text-xs font-medium py-2",
                      d === "일" ? "text-red-400" : d === "토" ? "text-blue-400" : "text-[var(--text-muted)]",
                    )}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-px bg-[var(--border)] rounded-lg overflow-hidden">
                  {cells.map((day, i) => {
                    const dayPosts = day ? postsByDay.get(day) ?? [] : [];
                    const dayPublishes = day ? publishesByDay.get(day) ?? [] : [];
                    const isToday = day === todayDay;

                    return (
                      <div
                        key={i}
                        onClick={() => {
                          if (!day) return;
                          if (dayPosts.length === 1) {
                            router.push(`/dashboard/${dayPosts[0].id}/edit`);
                          } else if (dayPosts.length === 0) {
                            router.push("/dashboard/new");
                          }
                        }}
                        className={cn(
                          "min-h-[90px] p-1.5 bg-[var(--bg)] transition-colors",
                          !day && "bg-[var(--bg-elevated)]/50",
                          isToday && "bg-[var(--accent-soft)]",
                          day && "cursor-pointer hover:bg-[var(--bg-elevated)]",
                        )}
                      >
                        {day && (
                          <>
                            <p className={cn(
                              "text-xs font-medium mb-1",
                              isToday && "text-[var(--accent)] font-bold",
                              !isToday && "text-[var(--text-secondary)]",
                            )}>
                              {day}
                            </p>
                            <div className="space-y-0.5">
                              {dayPosts.slice(0, 3).map((post, j) => (
                                <Link
                                  key={`${post.id}-${j}`}
                                  href={`/dashboard/${post.id}/edit`}
                                  className="block no-underline"
                                >
                                  <div className={cn(
                                    "text-[10px] leading-tight px-1 py-0.5 rounded truncate border",
                                    STATUS_COLORS[post.status] ?? STATUS_COLORS.draft,
                                  )}>
                                    {CATEGORY_EMOJI[post.placeCategory ?? ""] ?? ""}
                                    {" "}
                                    {post.placeName ?? "글"}
                                  </div>
                                </Link>
                              ))}
                              {dayPublishes.length > 0 && (
                                <div className="text-[10px] text-green-400 px-1">
                                  {dayPublishes.length}건 발행
                                </div>
                              )}
                              {dayPosts.length > 3 && (
                                <p className="text-[10px] text-[var(--text-muted)] px-1">
                                  +{dayPosts.length - 3}
                                </p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex items-center gap-4 justify-center">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-yellow-500/30 border border-yellow-500/50" />
            <span className="text-xs text-[var(--text-muted)]">초안</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-green-500/30 border border-green-500/50" />
            <span className="text-xs text-[var(--text-muted)]">완료</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-blue-500/30 border border-blue-500/50" />
            <span className="text-xs text-[var(--text-muted)]">예약</span>
          </div>
        </div>
      </div>
    </section>
  );
}
