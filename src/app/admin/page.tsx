"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type AllowedEmail = {
  id: number;
  email: string;
  memo: string | null;
  createdAt: string;
};

type UserSummary = {
  userId: number;
  name: string;
  email: string;
  createdAt: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  callCount: number;
};

type MonthlySummary = {
  month: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  callCount: number;
};

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatKRW(usd: number): string {
  const krw = Math.round(usd * 1300);
  return `₩${krw.toLocaleString()}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [monthly, setMonthly] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Allowed emails management
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newMemo, setNewMemo] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailAdding, setEmailAdding] = useState(false);

  const fetchAllowedEmails = () => {
    fetch("/api/admin/allowed-emails")
      .then((r) => (r.ok ? r.json() : { emails: [] }))
      .then((data) => setAllowedEmails(data.emails ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    fetch("/api/admin")
      .then((r) => {
        if (r.status === 403) throw new Error("관리자 권한이 없습니다");
        if (!r.ok) throw new Error("데이터를 불러올 수 없습니다");
        return r.json();
      })
      .then((data) => {
        setUsers(data.users ?? []);
        setMonthly(data.monthly ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    fetchAllowedEmails();
  }, []);

  const handleAddEmail = async () => {
    setEmailError("");
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("올바른 이메일을 입력해주세요");
      return;
    }
    setEmailAdding(true);
    try {
      const res = await fetch("/api/admin/allowed-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, memo: newMemo.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEmailError(data.error ?? "추가 실패");
        return;
      }
      setNewEmail("");
      setNewMemo("");
      fetchAllowedEmails();
    } catch {
      setEmailError("추가 실패");
    } finally {
      setEmailAdding(false);
    }
  };

  const handleRemoveEmail = async (id: number) => {
    try {
      await fetch(`/api/admin/allowed-emails?id=${id}`, { method: "DELETE" });
      fetchAllowedEmails();
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-[var(--bg-elevated)] rounded w-32" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-[var(--bg-elevated)] rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-[var(--bg-elevated)] rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard" className="no-underline">대시보드로 돌아가기</Link>
        </Button>
      </div>
    );
  }

  // Totals
  const totalUsers = users.length;
  const totalCalls = users.reduce((sum, u) => sum + u.callCount, 0);
  const totalCost = users.reduce((sum, u) => sum + u.totalCost, 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthData = monthly.find((m) => m.month === thisMonth);
  const thisMonthCost = thisMonthData?.cost ?? 0;

  // Filter
  const filtered = search
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()),
      )
    : users;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">관리자 대시보드</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">사용자 및 API 사용량 관리</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard" className="no-underline">대시보드</Link>
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-[var(--text-muted)] mb-1">전체 사용자</p>
            <p className="text-3xl font-bold">{totalUsers}<span className="text-sm font-normal text-[var(--text-muted)] ml-1">명</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-[var(--text-muted)] mb-1">전체 API 호출</p>
            <p className="text-3xl font-bold">{totalCalls}<span className="text-sm font-normal text-[var(--text-muted)] ml-1">회</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-[var(--text-muted)] mb-1">이번 달 비용</p>
            <p className="text-3xl font-bold">{formatCost(thisMonthCost)}</p>
            <p className="text-xs text-[var(--text-muted)]">{formatKRW(thisMonthCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-[var(--text-muted)] mb-1">누적 비용</p>
            <p className="text-3xl font-bold">{formatCost(totalCost)}</p>
            <p className="text-xs text-[var(--text-muted)]">{formatKRW(totalCost)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Allowed Emails */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">가입 허용 이메일</CardTitle>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {allowedEmails.length === 0 ? "목록이 비어있으면 누구나 가입 가능합니다" : `${allowedEmails.length}개 등록됨 — 목록에 있는 이메일만 가입 가능`}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add form */}
          <div className="flex flex-col sm:flex-row gap-2 items-start">
            <div className="flex-1 space-y-1">
              <Input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="이메일 주소"
                type="email"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddEmail(); }}
              />
            </div>
            <div className="w-full sm:w-40">
              <Input
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value)}
                placeholder="메모 (선택)"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddEmail(); }}
              />
            </div>
            <Button onClick={handleAddEmail} disabled={emailAdding} size="sm" className="shrink-0 mt-0.5">
              {emailAdding ? "추가 중..." : "추가"}
            </Button>
          </div>
          {emailError && (
            <p className="text-xs text-red-400" role="alert">{emailError}</p>
          )}

          {/* Email list */}
          {allowedEmails.length > 0 && (
            <div className="border border-[var(--border)] rounded-lg divide-y divide-[var(--border)]">
              {allowedEmails.map((ae) => (
                <div key={ae.id} className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{ae.email}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {ae.memo && <span className="mr-2">{ae.memo}</span>}
                      {new Date(ae.createdAt).toLocaleDateString("ko-KR")} 등록
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveEmail(ae.id)}
                    className="text-red-400 hover:text-red-300 shrink-0"
                  >
                    삭제
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Summary */}
      {monthly.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">월별 사용량</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th scope="col" className="text-left py-2 text-[var(--text-muted)] font-medium">월</th>
                    <th scope="col" className="text-right py-2 text-[var(--text-muted)] font-medium">호출 수</th>
                    <th scope="col" className="text-right py-2 text-[var(--text-muted)] font-medium">입력 토큰</th>
                    <th scope="col" className="text-right py-2 text-[var(--text-muted)] font-medium">출력 토큰</th>
                    <th scope="col" className="text-right py-2 text-[var(--text-muted)] font-medium">비용 (USD)</th>
                    <th scope="col" className="text-right py-2 text-[var(--text-muted)] font-medium">비용 (KRW)</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.month} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2.5 font-medium">{m.month}</td>
                      <td className="py-2.5 text-right">{m.callCount}회</td>
                      <td className="py-2.5 text-right">{formatTokens(m.inputTokens)}</td>
                      <td className="py-2.5 text-right">{formatTokens(m.outputTokens)}</td>
                      <td className="py-2.5 text-right">{formatCost(m.cost)}</td>
                      <td className="py-2.5 text-right">{formatKRW(m.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg">사용자 목록</CardTitle>
            <Input
              placeholder="이름 또는 이메일 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">
              {search ? "검색 결과가 없습니다" : "등록된 사용자가 없습니다"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th scope="col" className="text-left py-2 text-[var(--text-muted)] font-medium">사용자</th>
                    <th scope="col" className="text-right py-2 text-[var(--text-muted)] font-medium">가입일</th>
                    <th scope="col" className="text-right py-2 text-[var(--text-muted)] font-medium">API 호출</th>
                    <th scope="col" className="text-right py-2 text-[var(--text-muted)] font-medium">토큰 사용량</th>
                    <th scope="col" className="text-right py-2 text-[var(--text-muted)] font-medium">비용</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.userId} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2.5">
                        <div>
                          <p className="font-medium">{u.name || "(이름 없음)"}</p>
                          <p className="text-xs text-[var(--text-muted)]">{u.email}</p>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-[var(--text-secondary)]">
                        {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="py-2.5 text-right">
                        {u.callCount > 0 ? (
                          <Badge variant="secondary" className="text-xs">{u.callCount}회</Badge>
                        ) : (
                          <span className="text-[var(--text-muted)]">-</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-[var(--text-secondary)]">
                        {u.callCount > 0 ? (
                          <span className="text-xs">
                            {formatTokens(u.totalInputTokens)} / {formatTokens(u.totalOutputTokens)}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">-</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {u.totalCost > 0 ? (
                          <div>
                            <p className="font-medium">{formatCost(u.totalCost)}</p>
                            <p className="text-xs text-[var(--text-muted)]">{formatKRW(u.totalCost)}</p>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
