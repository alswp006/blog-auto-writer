"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        isActive && "bg-[var(--accent)]/10 text-[var(--accent)]",
      )}
      asChild
    >
      <Link href={href} className="no-underline">
        {label}
      </Link>
    </Button>
  );
}

function MobileNavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "justify-start",
        isActive && "bg-[var(--accent)]/10 text-[var(--accent)]",
      )}
      asChild
    >
      <Link href={href} className="no-underline">{label}</Link>
    </Button>
  );
}

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

  const navItems = [
    { href: "/dashboard", label: "대시보드" },
    { href: "/dashboard/new", label: "새 글" },
    { href: "/style-profiles", label: "문체" },
    { href: "/dashboard/analytics", label: "분석" },
    { href: "/dashboard/calendar", label: "캘린더" },
    { href: "/dashboard/settings", label: "설정" },
    { href: "/about", label: "소개" },
  ];

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--bg-elevated)] relative">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href={user ? "/dashboard" : "/"} className="text-sm font-bold no-underline hover:no-underline text-[var(--text)] whitespace-nowrap shrink-0">
          블로그 자동 작성기
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {user ? (
            <>
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} pathname={pathname} />
              ))}
              {user.isAdmin && (
                <NavLink href="/admin" label="관리자" pathname={pathname} />
              )}
              <span className="text-xs text-[var(--text-muted)] ml-2">{user.name || user.email}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                로그아웃
              </Button>
            </>
          ) : (
            <>
              <NavLink href="/about" label="소개" pathname={pathname} />
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

        {/* Mobile hamburger button — 44×44px touch target (WCAG) */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden flex flex-col justify-center items-center w-11 h-11 gap-1.5 shrink-0"
          aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={mobileOpen}
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
                {navItems.map((item) => (
                  <MobileNavLink key={item.href} href={item.href} label={item.label} pathname={pathname} />
                ))}
                {user.isAdmin && (
                  <MobileNavLink href="/admin" label="관리자" pathname={pathname} />
                )}
                <div className="border-t border-[var(--border)] mt-1 pt-1">
                  <Button variant="outline" size="sm" onClick={handleLogout} className="w-full">
                    로그아웃
                  </Button>
                </div>
              </>
            ) : (
              <>
                <MobileNavLink href="/about" label="소개" pathname={pathname} />
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
