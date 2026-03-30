"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Platform = "tistory" | "medium" | "wordpress";

const PLATFORM_LABELS: Record<Platform, string> = {
  tistory: "티스토리",
  medium: "Medium",
  wordpress: "WordPress",
};

type SchedulePost = {
  scheduledAt: string | null;
  scheduledPlatform: string | null;
  scheduledLang: string | null;
};

export function SchedulePublishCard({
  postId,
  post,
  lang,
  onUpdate,
  onToast,
}: {
  postId: string;
  post: SchedulePost;
  lang: "ko" | "en";
  onUpdate: (post: SchedulePost) => void;
  onToast: (msg: string) => void;
}) {
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [schedulePlatform, setSchedulePlatform] = useState<Platform>("tistory");
  const [scheduling, setScheduling] = useState(false);

  const handleSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      onToast("날짜와 시간을 선택해주세요");
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
      onUpdate(data.post);
      onToast("예약 발행이 설정되었습니다!");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "예약 설정 실패");
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
      onUpdate(data.post);
      setScheduleDate("");
      setScheduleTime("");
      onToast("예약이 취소되었습니다");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "예약 취소 실패");
    } finally {
      setScheduling(false);
    }
  };

  return (
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
            <Button variant="destructive" size="sm" onClick={handleUnschedule} disabled={scheduling}>
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
                <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
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
            <Button onClick={handleSchedule} disabled={scheduling || !scheduleDate || !scheduleTime} className="w-full">
              {scheduling ? "설정 중..." : "예약 발행 설정"}
            </Button>
            <p className="text-xs text-[var(--text-muted)]">
              현재 선택된 언어({lang === "ko" ? "한국어" : "English"})로 발행됩니다
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
