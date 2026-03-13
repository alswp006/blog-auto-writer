"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ id: number; name: string; email: string; isAdmin?: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null));
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
  };

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href={user ? "/dashboard" : "/"} className="text-sm font-bold no-underline hover:no-underline text-[var(--text)]">
          블로그 자동 작성기
        </Link>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard" className="no-underline">
                  대시보드
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/new" className="no-underline">
                  새 글
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/style-profiles" className="no-underline">
                  문체
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/calendar" className="no-underline">
                  캘린더
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/settings" className="no-underline">
                  설정
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/about" className="no-underline">
                  소개
                </Link>
              </Button>
              {user.isAdmin && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin" className="no-underline">
                    관리자
                  </Link>
                </Button>
              )}
              <span className="text-xs text-[var(--text-muted)]">{user.name || user.email}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                로그아웃
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/about" className="no-underline">
                  소개
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/login" className="no-underline">
                  로그인
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup" className="no-underline">
                  회원가입
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
