"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AgeGroup = "20s" | "30s" | "40plus";
type PreferredTone = "casual" | "detailed";
type PrimaryPlatform = "naver" | "tistory" | "medium";

type ProfileForm = {
  nickname: string;
  ageGroup: AgeGroup;
  preferredTone: PreferredTone;
  primaryPlatform: PrimaryPlatform;
};

type FieldErrors = Partial<Record<keyof ProfileForm, string>>;

const selectClass =
  "w-full h-10 rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-colors";

function LoadingSkeleton() {
  return (
    <section className="w-full py-20">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto animate-pulse space-y-6">
          <div>
            <div className="h-7 bg-[var(--bg-elevated)] rounded w-48" />
            <div className="h-4 bg-[var(--bg-elevated)] rounded w-64 mt-2" />
          </div>
          <Card>
            <CardContent className="p-6 space-y-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-[var(--bg-elevated)] rounded w-24" />
                  <div className="h-10 bg-[var(--bg-elevated)] rounded" />
                </div>
              ))}
              <div className="h-11 bg-[var(--bg-elevated)] rounded mt-2" />
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

export default function OnboardingProfilePage() {
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<ProfileForm>({
    nickname: "",
    ageGroup: "20s",
    preferredTone: "casual",
    primaryPlatform: "naver",
  });

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) {
          setHasProfile(true);
          setForm({
            nickname: data.profile.nickname,
            ageGroup: data.profile.ageGroup,
            preferredTone: data.profile.preferredTone,
            primaryPlatform: data.profile.primaryPlatform,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setSuccess(false);

    const method = hasProfile ? "PATCH" : "POST";
    try {
      const res = await fetch("/api/profile", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.fields) {
          setFieldErrors(data.error.fields as FieldErrors);
        }
        return;
      }

      setHasProfile(true);
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <section className="w-full py-20">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">
              {hasProfile ? "프로필 수정" : "프로필 설정"}
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              블로그 글 생성에 사용할 기본 설정을 입력해주세요.
            </p>
          </div>

          {success && (
            <div
              role="status"
              className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-400"
            >
              프로필이 저장되었습니다!
            </div>
          )}

          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Nickname */}
                <div className="space-y-1.5">
                  <Label htmlFor="nickname">닉네임</Label>
                  <Input
                    id="nickname"
                    value={form.nickname}
                    onChange={(e) => handleChange("nickname", e.target.value)}
                    placeholder="블로그에서 사용할 이름"
                    maxLength={30}
                    className={cn(fieldErrors.nickname && "border-red-500 focus-visible:ring-red-500")}
                  />
                  {fieldErrors.nickname && (
                    <p className="text-xs text-red-500">{fieldErrors.nickname}</p>
                  )}
                </div>

                {/* Age Group */}
                <div className="space-y-1.5">
                  <Label htmlFor="ageGroup">나이대</Label>
                  <select
                    id="ageGroup"
                    value={form.ageGroup}
                    onChange={(e) => handleChange("ageGroup", e.target.value)}
                    className={cn(selectClass, fieldErrors.ageGroup && "border-red-500")}
                  >
                    <option value="20s">20대</option>
                    <option value="30s">30대</option>
                    <option value="40plus">40대+</option>
                  </select>
                  {fieldErrors.ageGroup && (
                    <p className="text-xs text-red-500">{fieldErrors.ageGroup}</p>
                  )}
                </div>

                {/* Preferred Tone */}
                <div className="space-y-1.5">
                  <Label htmlFor="preferredTone">선호 문체</Label>
                  <select
                    id="preferredTone"
                    value={form.preferredTone}
                    onChange={(e) => handleChange("preferredTone", e.target.value)}
                    className={cn(selectClass, fieldErrors.preferredTone && "border-red-500")}
                  >
                    <option value="casual">친근한 일상체</option>
                    <option value="detailed">상세 리뷰체</option>
                  </select>
                  {fieldErrors.preferredTone && (
                    <p className="text-xs text-red-500">{fieldErrors.preferredTone}</p>
                  )}
                </div>

                {/* Primary Platform */}
                <div className="space-y-1.5">
                  <Label htmlFor="primaryPlatform">주로 쓰는 블로그 플랫폼</Label>
                  <select
                    id="primaryPlatform"
                    value={form.primaryPlatform}
                    onChange={(e) => handleChange("primaryPlatform", e.target.value)}
                    className={cn(selectClass, fieldErrors.primaryPlatform && "border-red-500")}
                  >
                    <option value="naver">네이버 블로그</option>
                    <option value="tistory">티스토리</option>
                    <option value="medium">Medium</option>
                  </select>
                  {fieldErrors.primaryPlatform && (
                    <p className="text-xs text-red-500">{fieldErrors.primaryPlatform}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full min-h-[44px]"
                  disabled={submitting || loading}
                >
                  {submitting
                    ? "저장 중..."
                    : hasProfile
                    ? "프로필 수정"
                    : "프로필 만들기"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard" className="no-underline text-[var(--text-muted)]">
                Dashboard로 이동 →
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
