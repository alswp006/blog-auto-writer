"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Globe, PenTool } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

const features = [
  {
    icon: <Zap className="w-5 h-5" />,
    title: "사진만 올리면 5분 안에 글 완성",
    bg: "bg-[var(--warm-soft)]",
    color: "text-[var(--warm)]",
  },
  {
    icon: <Globe className="w-5 h-5" />,
    title: "한국어·영어 동시에, 번역 아닌 창작",
    bg: "bg-[var(--accent-soft)]",
    color: "text-[var(--accent)]",
  },
  {
    icon: <PenTool className="w-5 h-5" />,
    title: "내 문체를 학습해서 나답게 써줘요",
    bg: "bg-[var(--success-soft)]",
    color: "text-[var(--success)]",
  },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "로그인에 실패했습니다");
        return;
      }

      router.push(redirect);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4 sm:px-6 py-12">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
        {/* Left: Branding */}
        <div className="flex flex-col gap-8 fade-in-up">
          <div>
            <h2 className="text-3xl font-bold leading-tight">
              Blog Auto Writer
              <span className="text-[var(--accent)]"> .</span>
            </h2>
            <p className="mt-3 text-[var(--text-secondary)] leading-[1.8]">
              맛집 사진 한 장이면 블로그 글이 완성돼요.<br />
              가족이 함께 쓰는 블로그 수익화 도구.
            </p>
          </div>
          <div className="space-y-3">
            {features.map((item) => (
              <div
                key={item.title}
                className="flex items-center gap-4 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover-lift"
              >
                <div className={`w-10 h-10 rounded-lg ${item.bg} ${item.color} flex items-center justify-center shrink-0`}>
                  {item.icon}
                </div>
                <span className="text-sm font-medium text-[var(--text-secondary)]">{item.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Form */}
        <div className="space-y-6 fade-in-up fade-in-up-delay-1">
          <div className="text-center md:text-left">
            <h1 className="text-2xl font-bold">다시 와주셨네요!</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">이메일로 로그인하세요</p>
          </div>

          <Card>
            <CardContent className="pt-6 px-6 pb-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div role="alert" aria-live="polite" className="text-sm px-3 py-2 rounded-md bg-[var(--danger-soft)] text-[var(--danger)]">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">비밀번호</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "로그인 중..." : "로그인"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-[var(--text-muted)]">
            아직 계정이 없으신가요?{" "}
            <Link href="/signup" className="text-[var(--accent)] font-medium">회원가입</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
