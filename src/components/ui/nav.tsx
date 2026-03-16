"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ id: number; name: string; email: string; isAdmin?: boolean } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null));
  }, [pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setMobileOpen(false);
    router.push("/");
  };

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--bg-elevated)] relative">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href={user ? "/dashboard" : "/"} className="text-sm font-bold no-underline hover:no-underline text-[var(--text)] whitespace-nowrap shrink-0">
          블로그 자동 작성기
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-2">
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

        {/* Mobile hamburger button */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5 shrink-0"
          aria-label="메뉴 열기"
        >
          <span className={`block w-5 h-0.5 bg-[var(--text)] transition-transform ${mobileOpen ? "rotate-45 translate-y-1" : ""}`} />
          <span className={`block w-5 h-0.5 bg-[var(--text)] transition-opacity ${mobileOpen ? "opacity-0" : ""}`} />
          <span className={`block w-5 h-0.5 bg-[var(--text)] transition-transform ${mobileOpen ? "-rotate-45 -translate-y-1" : ""}`} />
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden absolute left-0 right-0 top-full bg-[var(--bg-elevated)] border-b border-[var(--border)] shadow-lg z-50">
          <div className="flex flex-col px-4 py-3 gap-1">
            {user ? (
              <>
                <span className="text-xs text-[var(--text-muted)] px-3 py-1">{user.name || user.email}</span>
                <Button variant="ghost" size="sm" className="justify-start" asChild>
                  <Link href="/dashboard" className="no-underline">대시보드</Link>
                </Button>
                <Button variant="ghost" size="sm" className="justify-start" asChild>
                  <Link href="/dashboard/new" className="no-underline">새 글</Link>
                </Button>
                <Button variant="ghost" size="sm" className="justify-start" asChild>
                  <Link href="/style-profiles" className="no-underline">문체</Link>
                </Button>
                <Button variant="ghost" size="sm" className="justify-start" asChild>
                  <Link href="/dashboard/calendar" className="no-underline">캘린더</Link>
                </Button>
                <Button variant="ghost" size="sm" className="justify-start" asChild>
                  <Link href="/dashboard/settings" className="no-underline">설정</Link>
                </Button>
                <Button variant="ghost" size="sm" className="justify-start" asChild>
                  <Link href="/about" className="no-underline">소개</Link>
                </Button>
                {user.isAdmin && (
                  <Button variant="ghost" size="sm" className="justify-start" asChild>
                    <Link href="/admin" className="no-underline">관리자</Link>
                  </Button>
                )}
                <div className="border-t border-[var(--border)] mt-1 pt-1">
                  <Button variant="outline" size="sm" onClick={handleLogout} className="w-full">
                    로그아웃
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="justify-start" asChild>
                  <Link href="/about" className="no-underline">소개</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/login" className="no-underline">로그인</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/signup" className="no-underline">회원가입</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
