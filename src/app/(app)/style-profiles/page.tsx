"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StyleProfileSummary = {
  id: number;
  name: string;
  isSystemPreset: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProfilesData = {
  presets: StyleProfileSummary[];
  customs: StyleProfileSummary[];
};

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 animate-pulse space-y-3">
      <div className="h-4 bg-[var(--bg-elevated)] rounded w-3/4" />
      <div className="h-3 bg-[var(--bg-elevated)] rounded w-1/2" />
      <div className="h-5 bg-[var(--bg-elevated)] rounded w-16" />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div className="h-5 bg-[var(--bg-elevated)] rounded w-24 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-5 bg-[var(--bg-elevated)] rounded w-28 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </div>
  );
}

// ── Profile Card ──────────────────────────────────────────────────────────────

function ProfileCard({ profile }: { profile: StyleProfileSummary }) {
  const date = new Date(profile.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Card className="transition-shadow hover:shadow-md hover:shadow-black/10 dark:hover:shadow-black/30">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-tight text-[var(--text)] line-clamp-2">
            {profile.name}
          </h3>
          {profile.isSystemPreset ? (
            <Badge variant="secondary" className="shrink-0 text-xs">기본</Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-xs">커스텀</Badge>
          )}
        </div>
        <p className="text-xs text-[var(--text-muted)]">{date} 생성</p>
      </CardContent>
    </Card>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyCustoms() {
  return (
    <div className="col-span-full flex flex-col items-center gap-3 py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--text-muted)]"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--text)]">아직 커스텀 문체가 없습니다</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          위 양식으로 나만의 문체를 만들어보세요.
        </p>
      </div>
    </div>
  );
}

// ── Create Form ───────────────────────────────────────────────────────────────

type CreateFormProps = {
  onCreated: () => void;
};

function CreateForm({ onCreated }: CreateFormProps) {
  const [name, setName] = useState("");
  const [sampleTexts, setSampleTexts] = useState<string[]>(["", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [sampleTextsError, setSampleTextsError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const addSample = () => {
    if (sampleTexts.length < 5) setSampleTexts((p) => [...p, ""]);
  };

  const removeSample = (idx: number) => {
    if (sampleTexts.length > 3) {
      setSampleTexts((p) => p.filter((_, i) => i !== idx));
    }
  };

  const updateSample = (idx: number, value: string) => {
    setSampleTexts((p) => p.map((t, i) => (i === idx ? value : t)));
    if (sampleTextsError) setSampleTextsError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setNameError(null);
    setSampleTextsError(null);
    setGeneralError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/style-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sampleTexts }),
      });

      const data = await res.json();

      if (!res.ok) {
        const fields = data?.error?.fields as Record<string, string> | undefined;
        if (fields?.name) setNameError(fields.name);
        if (fields?.sampleTexts) setSampleTextsError(fields.sampleTexts);
        if (!fields || (!fields.name && !fields.sampleTexts)) {
          setGeneralError(data?.error?.message ?? "오류가 발생했습니다.");
        }
        return;
      }

      setName("");
      setSampleTexts(["", "", ""]);
      setSuccess(true);
      onCreated();
    } catch {
      setGeneralError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">문체 프로필 만들기</CardTitle>
        <CardDescription className="text-sm">
          본인이 쓴 글 3~5개를 붙여넣으면 문체를 분석해드립니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="style-name">문체 이름</Label>
            <Input
              id="style-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="예: 내 블로그 톤"
              className={cn("w-full", nameError && "border-red-500 focus-visible:ring-red-500")}
            />
            {nameError && <p className="text-xs text-red-500">{nameError}</p>}
          </div>

          {/* Sample texts */}
          <div className="space-y-2">
            <Label>샘플 글 ({sampleTexts.length}/5)</Label>
            {sampleTexts.map((text, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <Textarea
                  value={text}
                  onChange={(e) => updateSample(idx, e.target.value)}
                  placeholder={`샘플 ${idx + 1} — 본인이 쓴 글의 일부를 붙여넣어주세요...`}
                  rows={3}
                  className={cn(
                    "w-full resize-none",
                    sampleTextsError && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
                {sampleTexts.length > 3 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSample(idx)}
                    className="shrink-0 mt-1 text-[var(--text-muted)] hover:text-red-500"
                    aria-label="삭제"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </Button>
                )}
              </div>
            ))}
            {sampleTextsError && (
              <p className="text-xs text-red-500">{sampleTextsError}</p>
            )}
            {sampleTexts.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSample}
                className="text-xs"
              >
                + 샘플 추가
              </Button>
            )}
          </div>

          {generalError && (
            <p className="text-sm text-red-500">{generalError}</p>
          )}

          {success && (
            <div
              role="status"
              className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-400"
            >
              문체 프로필이 생성되었습니다!
            </div>
          )}

          <Button
            type="submit"
            className="w-full min-h-[44px]"
            disabled={submitting}
          >
            {submitting ? "분석 중..." : "문체 만들기"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StyleProfilesPage() {
  const [data, setData] = useState<ProfilesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/style-profiles");
      if (!res.ok) throw new Error(`요청 실패 (${res.status})`);
      const json = (await res.json()) as ProfilesData;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "문체 프로필을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  return (
    <section className="w-full py-20">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 space-y-10">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">문체 프로필</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            기본 프리셋을 사용하거나, 본인의 글 샘플로 커스텀 문체를 만들어보세요.
          </p>
        </div>

        {/* Create form + contextual info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            <CreateForm onCreated={fetchProfiles} />
            {error && (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p className="text-sm text-red-400">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchProfiles}
                  className="shrink-0 border-red-500/40 text-red-400 hover:bg-red-500/10 min-h-[44px]"
                >
                  다시 시도
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-6 py-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)] mb-2">문체 프로필이란?</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-[1.7]">
                문체 프로필은 나만의 글쓰기 스타일을 담는 설정입니다. 문장 리듬, 어휘, 톤, 감성 등을 분석하여
                AI가 블로그 글을 생성할 때 해당 스타일을 반영합니다.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)] mb-3">좋은 샘플 작성 팁</h3>
              <ul className="space-y-2.5">
                {[
                  "직접 쓴 글을 그대로 사용하세요 (수정본 말고 원본)",
                  "다양한 주제의 글을 넣으면 더 정확해요",
                  "각 샘플은 최소 2~3문단 정도가 좋아요",
                  "짧은 한줄평이나 목록보다는 자연스러운 글이 좋아요",
                ].map((tip) => (
                  <li key={tip} className="flex gap-2.5 text-sm text-[var(--text-secondary)]">
                    <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-[var(--accent-soft)] flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1.5 4L3.5 6L6.5 2" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <p className="text-xs text-[var(--text-muted)] leading-[1.7]">
                <span className="font-medium text-[var(--text-secondary)]">기본 프리셋</span>은 별도 설정 없이 바로 사용할 수 있습니다.
                일상체, 전문 리뷰체 등 일반적인 스타일을 제공합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <LoadingSkeleton />
        ) : data ? (
          <div className="space-y-10">
            {/* Presets */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                기본 프리셋
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.presets.map((p) => (
                  <ProfileCard key={p.id} profile={p} />
                ))}
              </div>
            </div>

            {/* Your styles */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                내 커스텀 문체
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.customs.length === 0 ? (
                  <EmptyCustoms />
                ) : (
                  data.customs.map((p) => <ProfileCard key={p.id} profile={p} />)
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
