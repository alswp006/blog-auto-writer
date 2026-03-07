"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

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
        setError(data.error ?? "Login failed");
        return;
      }

      router.push(redirect);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-6 py-12">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left: Branding */}
        <div className="flex flex-col gap-8">
          <div>
            <h2 className="text-3xl font-bold text-[var(--text)] leading-tight">Blog Auto Writer</h2>
            <p className="mt-3 text-[var(--text-secondary)] leading-[1.7]">
              사진과 메모만 올리면 5분 안에 한영 포스팅이 완성됩니다. 가족이 함께 쓰는 블로그 수익화 도구.
            </p>
          </div>
          <ul className="space-y-6">
            {[
              { icon: "⚡", text: "5분 안에 포스팅 완성" },
              { icon: "🌐", text: "한영 자동 번역 지원" },
              { icon: "✍️", text: "나만의 글쓰기 스타일 학습" },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                <span className="text-xl shrink-0">{item.icon}</span>
                <span className="font-medium">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: Form */}
        <div className="space-y-6">
          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold">Login</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">Welcome back</p>
          </div>

          <Card>
            <CardContent className="pt-6 px-6 pb-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="text-xs px-3 py-2 rounded-md bg-[var(--danger-soft)] text-[var(--danger)]">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
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
                  <Label htmlFor="password">Password</Label>
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
                  {loading ? "Logging in..." : "Login"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-[var(--text-muted)]">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[var(--accent)]">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
