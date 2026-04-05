"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Post, Lang, Platform, PublishHistoryItem } from "./types";
import { PLATFORM_LABELS, PLATFORM_COLORS } from "./types";

type Props = {
  postId: string;
  post: Post;
  lang: Lang;
  connections: { platform: string; hasToken: boolean }[];
  publishHistory: PublishHistoryItem[];
  onPublishHistoryUpdate: (history: PublishHistoryItem[]) => void;
  onPostUpdate: (post: Post) => void;
  showToast: (msg: string) => void;
};

export function PublishScheduleCard({
  postId, post, lang, connections, publishHistory,
  onPublishHistoryUpdate, onPostUpdate, showToast,
}: Props) {
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [schedulePlatform, setSchedulePlatform] = useState<Platform>("tistory");
  const [scheduling, setScheduling] = useState(false);

  const hasMediumConnection = connections.some((c) => c.platform === "medium" && c.hasToken);

  const handlePublish = async (platform: "medium" | "wordpress") => {
    setPublishing(true);
    setPublishedUrl(null);
    try {
      const res = await fetch(`/api/publish/${platform}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: parseInt(postId, 10), lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Publish failed");
      setPublishedUrl(data.url ?? null);
      showToast(`${PLATFORM_LABELS[platform]}에 발행 완료!`);
      const histRes = await fetch(`/api/posts/${postId}`);
      if (histRes.ok) {
        const histData = await histRes.json();
        onPublishHistoryUpdate(histData.publishHistory ?? []);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "발행 실패");
    } finally {
      setPublishing(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      showToast("날짜와 시간을 선택해주세요");
      return;
    }
    setScheduling(true);
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      const res = await fetch(`/api/posts/${postId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt, platform: schedulePlatform, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Schedule failed");
      onPostUpdate(data.post);
      showToast("예약 발행이 설정되었습니다!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "예약 설정 실패");
    } finally {
      setScheduling(false);
    }
  };

  const handleUnschedule = async () => {
    setScheduling(true);
    try {
      const res = await fetch(`/api/posts/${postId}/schedule`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unschedule failed");
      onPostUpdate(data.post);
      setScheduleDate("");
      setScheduleTime("");
      showToast("예약이 취소되었습니다");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "예약 취소 실패");
    } finally {
      setScheduling(false);
    }
  };

  return (
    <>
      {/* Auto Publish */}
      <Card>
        <CardHeader><CardTitle className="text-lg">자동 발행</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Button
                variant="outline"
                onClick={() => handlePublish("medium")}
                disabled={publishing}
                className="w-full"
              >
                {publishing ? "발행 중..." : "Medium에 발행"}
              </Button>
              {hasMediumConnection ? (
                <p className="text-xs text-green-500 text-center">연동됨</p>
              ) : (
                <p className="text-xs text-[var(--text-muted)] text-center">
                  <Link href="/dashboard/settings" className="text-[var(--accent)] hover:underline">설정에서 연동</Link>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Button
                variant="outline"
                onClick={() => handlePublish("wordpress")}
                disabled={publishing}
                className="w-full"
              >
                {publishing ? "발행 중..." : "WordPress에 발행"}
              </Button>
              <p className="text-xs text-[var(--text-muted)] text-center">환경변수 설정 필요</p>
            </div>
          </div>
          {publishedUrl && (
            <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm">
              <p className="text-green-400 text-xs mb-1">발행 완료!</p>
              <a
                href={publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] text-xs hover:underline break-all"
              >
                {publishedUrl}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Publish */}
      {post.status === "generated" && (
        <Card>
          <CardHeader><CardTitle className="text-lg">예약 발행</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {post.scheduledAt ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-[var(--accent-soft)] border border-[var(--accent)]/30 px-4 py-3">
                  <p className="text-sm font-medium">예약됨</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {new Date(post.scheduledAt).toLocaleString("ko-KR", {
                      year: "numeric", month: "long", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                    {" · "}
                    {PLATFORM_LABELS[post.scheduledPlatform as Platform] ?? post.scheduledPlatform}
                    {" · "}
                    {post.scheduledLang === "ko" ? "한국어" : "English"}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleUnschedule}
                  disabled={scheduling}
                >
                  {scheduling ? "취소 중..." : "예약 취소"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>날짜</Label>
                    <Input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>시간</Label>
                    <Input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>발행 플랫폼</Label>
                  <select
                    value={schedulePlatform}
                    onChange={(e) => setSchedulePlatform(e.target.value as Platform)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm"
                  >
                    <option value="tistory">티스토리</option>
                    <option value="medium">Medium</option>
                    <option value="wordpress">WordPress</option>
                  </select>
                </div>
                <Button
                  onClick={handleSchedule}
                  disabled={scheduling || !scheduleDate || !scheduleTime}
                  className="w-full"
                >
                  {scheduling ? "설정 중..." : "예약 발행 설정"}
                </Button>
                <p className="text-xs text-[var(--text-muted)]">
                  현재 선택된 언어({lang === "ko" ? "한국어" : "English"})로 발행됩니다
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Publish History */}
      {publishHistory.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">발행 이력</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {publishHistory.map((h) => (
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
      )}
    </>
  );
}
