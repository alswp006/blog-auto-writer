"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ConnectionInfo = {
  id: number;
  platform: "medium";
  blogName: string | null;
  platformUsername: string | null;
  connectedAt: string;
  hasToken: boolean;
};

export default function SettingsPage() {

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Connections
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Medium state
  const [mediumToken, setMediumToken] = useState("");
  const [mediumSaving, setMediumSaving] = useState(false);
  const [mediumDisconnecting, setMediumDisconnecting] = useState(false);

  // Watermark state
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkPosition, setWatermarkPosition] = useState("bottom-right");
  const [watermarkSaving, setWatermarkSaving] = useState(false);

  const mediumConnection = connections.find((c) => c.platform === "medium");

  // Fetch existing connections
  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/connections");
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch profile for watermark settings
  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setWatermarkText(data.profile.watermarkText ?? "");
          setWatermarkPosition(data.profile.watermarkPosition ?? "bottom-right");
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchConnections();
    fetchProfile();
  }, [fetchConnections, fetchProfile]);

  // ── Medium ──
  const handleMediumSave = async () => {
    if (!mediumToken.trim()) return;
    setMediumSaving(true);
    try {
      const res = await fetch("/api/connections/medium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationToken: mediumToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "연동 실패");
      showToast(`Medium 연동 완료! (@${data.connection.platformUsername})`);
      setMediumToken("");
      fetchConnections();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Medium 연동 실패");
    } finally {
      setMediumSaving(false);
    }
  };

  const handleWatermarkSave = async () => {
    setWatermarkSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watermarkText: watermarkText.trim() || null,
          watermarkPosition,
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      showToast("워터마크 설정 저장 완료!");
    } catch {
      showToast("워터마크 설정 저장 실패");
    } finally {
      setWatermarkSaving(false);
    }
  };

  const handleMediumDisconnect = async () => {
    setMediumDisconnecting(true);
    try {
      await fetch("/api/connections/medium", { method: "DELETE" });
      showToast("Medium 연동 해제됨");
      fetchConnections();
    } catch {
      showToast("연동 해제 실패");
    } finally {
      setMediumDisconnecting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast */}
      {toast && (
        <div role="alert" aria-live="assertive" className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[var(--bg-elevated)] border border-[var(--border)] text-sm px-5 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">설정</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">플랫폼 연동 및 계정 설정</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard" className="no-underline">대시보드</Link>
        </Button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-[var(--bg-elevated)] rounded-lg" />
          <div className="h-32 bg-[var(--bg-elevated)] rounded-lg" />
        </div>
      ) : (
        <>
          {/* Medium Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Medium 연동</CardTitle>
                  <CardDescription>Integration Token으로 Medium에 자동 발행합니다</CardDescription>
                </div>
                {mediumConnection && (
                  <Badge variant="default" className="text-xs">연동됨</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {mediumConnection ? (
                <>
                  <div className="rounded-lg bg-[var(--bg-elevated)] p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--text-secondary)]">계정</span>
                      <span className="text-sm font-medium">@{mediumConnection.platformUsername}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--text-secondary)]">연동일</span>
                      <span className="text-sm">{new Date(mediumConnection.connectedAt).toLocaleDateString("ko-KR")}</span>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleMediumDisconnect}
                    disabled={mediumDisconnecting}
                  >
                    {mediumDisconnecting ? "해제 중..." : "연동 해제"}
                  </Button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                    <h4 className="text-sm font-medium mb-2">연동 방법</h4>
                    <ol className="text-xs text-[var(--text-muted)] space-y-1.5 list-decimal list-inside">
                      <li>
                        <a
                          href="https://medium.com/me/settings/security"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--accent)] hover:underline"
                        >
                          Medium Settings &gt; Security
                        </a>
                        에서 Integration Token을 발급합니다
                      </li>
                      <li>아래에 토큰을 입력하고 연동 버튼을 클릭합니다</li>
                    </ol>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="medium-token">Integration Token</Label>
                    <Input
                      id="medium-token"
                      type="password"
                      value={mediumToken}
                      onChange={(e) => setMediumToken(e.target.value)}
                      placeholder="Medium Integration Token 입력"
                    />
                  </div>
                  <Button onClick={handleMediumSave} disabled={mediumSaving || !mediumToken.trim()}>
                    {mediumSaving ? "연동 중..." : "Medium 연동하기"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Watermark Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">워터마크 설정</CardTitle>
              <CardDescription>사진에 자동으로 워터마크를 추가합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="watermark-text">워터마크 텍스트</Label>
                <Input
                  id="watermark-text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="예: @myblog"
                  maxLength={50}
                />
                <p className="text-xs text-[var(--text-muted)]">비워두면 워터마크가 적용되지 않습니다 (최대 50자)</p>
              </div>
              <div className="space-y-2">
                <Label>워터마크 위치</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["top-left", "좌상단"],
                    ["top-right", "우상단"],
                    ["bottom-left", "좌하단"],
                    ["bottom-right", "우하단"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setWatermarkPosition(value)}
                      aria-pressed={watermarkPosition === value}
                      className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                        watermarkPosition === value
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-hover)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={handleWatermarkSave} disabled={watermarkSaving}>
                {watermarkSaving ? "저장 중..." : "워터마크 설정 저장"}
              </Button>
            </CardContent>
          </Card>

          {/* Env var info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">환경 변수 안내</CardTitle>
              <CardDescription>서버 환경변수로도 설정할 수 있습니다 (DB 연동이 우선)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-[var(--bg-elevated)] p-4 font-mono text-xs space-y-1 text-[var(--text-muted)]">
                <p># Medium</p>
                <p>MEDIUM_INTEGRATION_TOKEN=your_token</p>
                <p className="pt-2"># WordPress</p>
                <p>WORDPRESS_URL=https://your-site.com</p>
                <p>WORDPRESS_USERNAME=your_username</p>
                <p>WORDPRESS_APP_PASSWORD=your_app_password</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
