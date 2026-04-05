"use client";

import { useState, useEffect, use, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { Post, Photo, Place, PublishHistoryItem, Tab, Lang } from "./types";
import { getPhotoAlt } from "./format-utils";
import { NaverCopyModal } from "./NaverCopyModal";
import { SeoAnalysisCard } from "./SeoAnalysisCard";
import { CompetitorAnalysisCard } from "./CompetitorAnalysisCard";
import { PlatformCopyCard } from "./PlatformCopyCard";
import { PublishScheduleCard } from "./PublishScheduleCard";
import { RelatedPostsCard } from "./RelatedPostsCard";

export default function PostEditPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = use(params);
  const [post, setPost] = useState<Post | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("preview");
  const [lang, setLang] = useState<Lang>("ko");
  const [error, setError] = useState("");

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Edit fields
  const [titleKo, setTitleKo] = useState("");
  const [contentKo, setContentKo] = useState("");
  const [hashtagsKo, setHashtagsKo] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [hashtagsEn, setHashtagsEn] = useState("");

  // Publishing
  const [connections, setConnections] = useState<{ platform: string; hasToken: boolean }[]>([]);
  const [publishHistory, setPublishHistory] = useState<PublishHistoryItem[]>([]);

  // Watermark
  const [watermarkApplying, setWatermarkApplying] = useState(false);
  const [hasWatermarkText, setHasWatermarkText] = useState(false);

  // Keywords
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [keywordsLoading, setKeywordsLoading] = useState(false);

  // Partial Regeneration
  const [regenIndex, setRegenIndex] = useState<number | null>(null);
  const [regenFeedback, setRegenFeedback] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenPreview, setRegenPreview] = useState<string | null>(null);

  // Photo Analysis
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);

  // Title candidates
  const [titleCandidates, setTitleCandidates] = useState<{ titleKo: string; titleEn: string; style: string }[]>([]);
  const [titlesLoading, setTitlesLoading] = useState(false);

  // Version history
  const [versions, setVersions] = useState<{ id: number; titleKo: string | null; changeReason: string; createdAt: string }[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  // Naver copy modal
  const [naverModalHtml, setNaverModalHtml] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/posts/${postId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Post not found");
        return r.json();
      })
      .then((data) => {
        setPost(data.post);
        setPhotos(data.photos ?? []);
        setPlace(data.place ?? null);
        setPublishHistory(data.publishHistory ?? []);
        setTitleKo(data.post.titleKo ?? "");
        setContentKo(data.post.contentKo ?? "");
        setHashtagsKo((data.post.hashtagsKo ?? []).join(" "));
        setTitleEn(data.post.titleEn ?? "");
        setContentEn(data.post.contentEn ?? "");
        setHashtagsEn((data.post.hashtagsEn ?? []).join(" "));
      })
      .catch(() => setError("글을 불러올 수 없습니다"))
      .finally(() => setLoading(false));

    fetch("/api/connections")
      .then((r) => (r.ok ? r.json() : { connections: [] }))
      .then((data) => setConnections(data.connections ?? []))
      .catch(() => {});

    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : { profile: null }))
      .then((data) => setHasWatermarkText(!!data.profile?.watermarkText))
      .catch(() => {});
  }, [postId]);

  // Build photo lookup by orderIndex
  const photoByIndex = useMemo(() => new Map(photos.map((p) => [p.orderIndex, p])), [photos]);

  // ── Handlers ──
  const handleSave = async () => {
    if (!titleKo.trim() && !titleEn.trim()) {
      showToast("제목을 입력해주세요");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleKo, contentKo,
          hashtagsKo: hashtagsKo.split(/\s+/).filter(Boolean),
          titleEn, contentEn,
          hashtagsEn: hashtagsEn.split(/\s+/).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setPost(data.post);
      showToast("수정 저장 완료!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleSuggestKeywords = async () => {
    setKeywordsLoading(true);
    setSuggestedKeywords([]);
    try {
      const res = await fetch(`/api/posts/${postId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSuggestedKeywords(data.keywords ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "키워드 추천 실패");
    } finally {
      setKeywordsLoading(false);
    }
  };

  const handleAddKeyword = (keyword: string) => {
    if (lang === "ko") {
      const current = hashtagsKo.split(/\s+/).filter(Boolean);
      if (!current.includes(keyword)) setHashtagsKo([...current, keyword].join(" "));
    } else {
      const current = hashtagsEn.split(/\s+/).filter(Boolean);
      if (!current.includes(keyword)) setHashtagsEn([...current, keyword].join(" "));
    }
    setSuggestedKeywords((prev) => prev.filter((k) => k !== keyword));
    showToast(`${keyword} 추가됨`);
  };

  const handleApplyWatermark = async () => {
    if (photos.length === 0) return;
    setWatermarkApplying(true);
    try {
      const res = await fetch("/api/photos/watermark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: photos.map((p) => p.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Watermark failed");
      const resultMap = new Map((data.results as { photoId: number; filePath: string }[]).map((r) => [r.photoId, r.filePath]));
      setPhotos((prev) =>
        prev.map((p) => {
          const newPath = resultMap.get(p.id);
          return newPath ? { ...p, filePath: newPath } : p;
        }),
      );
      showToast(`워터마크 적용 완료! (${data.results.length}장)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "워터마크 적용 실패");
    } finally {
      setWatermarkApplying(false);
    }
  };

  const handleRegenerate = async () => {
    if (regenIndex === null || !regenFeedback.trim()) return;
    setRegenLoading(true);
    setRegenPreview(null);
    try {
      const res = await fetch(`/api/posts/${postId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, paragraphIndex: regenIndex, feedback: regenFeedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setRegenPreview(data.revisedParagraph);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "재생성 실패");
    } finally {
      setRegenLoading(false);
    }
  };

  const handleApplyRegen = () => {
    if (regenIndex === null || !regenPreview) return;
    const current = lang === "ko" ? contentKo : contentEn;
    const paragraphs = current.split("\n\n");
    paragraphs[regenIndex] = regenPreview;
    const updated = paragraphs.join("\n\n");
    if (lang === "ko") setContentKo(updated);
    else setContentEn(updated);
    setRegenIndex(null);
    setRegenFeedback("");
    setRegenPreview(null);
    showToast("문단이 교체되었습니다. 저장을 눌러주세요.");
  };

  const handleGenerateTitles = async () => {
    setTitlesLoading(true);
    setTitleCandidates([]);
    try {
      const res = await fetch(`/api/posts/${postId}/titles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setTitleCandidates(data.titles ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "제목 생성 실패");
    } finally {
      setTitlesLoading(false);
    }
  };

  const handleSelectTitle = (candidate: { titleKo: string; titleEn: string }) => {
    setTitleKo(candidate.titleKo);
    setTitleEn(candidate.titleEn);
    setTitleCandidates([]);
    showToast("제목이 변경되었습니다. 저장을 눌러주세요.");
  };

  const handleLoadVersions = async () => {
    if (showVersions) { setShowVersions(false); return; }
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/versions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setVersions(data.versions ?? []);
      setShowVersions(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "버전 로드 실패");
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleRestoreVersion = async (versionId: number) => {
    try {
      const res = await fetch(`/api/posts/${postId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const p = data.post;
      setPost(p);
      setTitleKo(p.titleKo ?? "");
      setContentKo(p.contentKo ?? "");
      setHashtagsKo((p.hashtagsKo ?? []).join(" "));
      setTitleEn(p.titleEn ?? "");
      setContentEn(p.contentEn ?? "");
      setHashtagsEn((p.hashtagsEn ?? []).join(" "));
      setShowVersions(false);
      showToast("이전 버전으로 복원되었습니다!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "복원 실패");
    }
  };

  const handleAnalyzePhotos = async () => {
    if (photos.length === 0) return;
    setPhotoAnalyzing(true);
    try {
      const res = await fetch("/api/photos/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: photos.map((p) => p.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const results = (data.results ?? []) as { photoId?: number; caption: string }[];
      const resultMap = new Map<number, string>();
      for (const r of results) {
        if (r.photoId && r.caption) resultMap.set(r.photoId, r.caption);
      }
      setPhotos((prev) =>
        prev.map((p) => {
          const newCaption = resultMap.get(p.id);
          return newCaption ? { ...p, caption: newCaption } : p;
        }),
      );
      showToast(`AI 캡션 생성 완료! (${resultMap.size}장)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "사진 분석 실패");
    } finally {
      setPhotoAnalyzing(false);
    }
  };

  // ── Loading / Error states ──
  if (loading) {
    return (
      <section className="w-full py-12">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto animate-pulse space-y-6">
            <div className="h-8 bg-[var(--bg-elevated)] rounded w-48" />
            <div className="h-64 bg-[var(--bg-elevated)] rounded" />
          </div>
        </div>
      </section>
    );
  }

  if (error && !post) {
    return (
      <section className="w-full py-12">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 text-center">
          <p className="text-red-400">{error}</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/dashboard" className="no-underline">대시보드</Link>
          </Button>
        </div>
      </section>
    );
  }

  // ── Preview helpers ──
  const previewTitle = (lang === "ko" ? post?.titleKo : post?.titleEn) ?? "";
  const previewContent = (lang === "ko" ? post?.contentKo : post?.contentEn) ?? "";
  const previewHashtags = (lang === "ko" ? post?.hashtagsKo : post?.hashtagsEn) ?? [];
  const paragraphs = previewContent ? previewContent.split("\n\n") : [];
  const hasPhotoMarkers = /\[PHOTO:\d+\]/.test(previewContent);
  const photoInsertIdx = hasPhotoMarkers ? -1 : Math.min(1, paragraphs.length);

  const renderPhotoByMarker = (marker: string) => {
    const match = marker.match(/\[PHOTO:(\d+)\]/);
    if (!match) return null;
    const idx = parseInt(match[1], 10);
    const photo = photoByIndex.get(idx);
    if (!photo) return null;
    return (
      <div className="my-4">
        <img
          src={photo.filePath}
          alt={getPhotoAlt(photo)}
          className="w-full rounded-lg max-h-[400px] object-cover"
        />
        {photo.caption && (
          <p className="text-xs text-center text-[var(--text-muted)] mt-1.5 italic">
            {photo.caption}
          </p>
        )}
      </div>
    );
  };

  const renderPhotoGrid = () => (
    <div className="grid grid-cols-1 gap-3 my-4">
      {photos.map((photo) => (
        <div key={photo.id}>
          <img
            src={photo.filePath}
            alt={photo.caption ?? `Photo ${photo.orderIndex}`}
            className="w-full rounded-lg max-h-[400px] object-cover"
          />
          {photo.caption && (
            <p className="text-xs text-center text-[var(--text-muted)] mt-1.5 italic">
              {photo.caption}
            </p>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
    <section className="w-full py-12">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Toast */}
          {toast && (
            <div role="alert" aria-live="assertive" className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[var(--bg-elevated)] border border-[var(--border)] text-sm px-5 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
              {toast}
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">글 편집</h1>
              {place && <p className="text-sm text-[var(--text-muted)] mt-1">{place.name}</p>}
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard" className="no-underline">목록으로</Link>
            </Button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          {post?.generationError && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
              생성 오류: {post.generationError}
            </div>
          )}

          {/* Tab + Lang Switcher */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-1 bg-[var(--bg-elevated)] rounded-lg p-1">
              {(["preview", "edit"] as Tab[]).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] flex items-center",
                  tab === t ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]",
                )}>
                  {t === "preview" ? "미리보기" : "편집"}
                </button>
              ))}
            </div>
            {tab === "preview" && (
              <div className="flex gap-1 bg-[var(--bg-elevated)] rounded-lg p-1">
                {(["ko", "en"] as Lang[]).map((l) => (
                  <button key={l} onClick={() => setLang(l)} className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] flex items-center",
                    lang === l ? "bg-[var(--bg-card)] text-[var(--text)]" : "text-[var(--text-muted)] hover:text-[var(--text)]",
                  )}>
                    {l === "ko" ? "한국어" : "English"}
                  </button>
                ))}
              </div>
            )}
            {tab === "edit" && (
              <span className="text-xs text-[var(--text-muted)]">한국어 · English 나란히 편집</span>
            )}
            <Badge variant={post?.status === "generated" ? "default" : "secondary"}>
              {post?.status === "generated" ? "완료" : "초안"}
            </Badge>
          </div>

          {/* Content Card */}
          <Card>
            <CardContent className="p-6 space-y-4">
              {tab === "preview" ? (
                <>
                  <h2 className="text-xl font-bold">{previewTitle || "(제목 없음)"}</h2>

                  {paragraphs.length === 0 && photos.length === 0 && (
                    <p className="text-sm text-[var(--text-muted)]">(내용 없음)</p>
                  )}

                  {paragraphs.map((p, i) => {
                    const markerMatch = p.trim().match(/^\[PHOTO:\d+\]$/);
                    if (hasPhotoMarkers && markerMatch) {
                      return <div key={i}>{renderPhotoByMarker(p.trim())}</div>;
                    }
                    return (
                      <div key={i}>
                        <p className="text-sm leading-relaxed text-[var(--text-secondary)] mb-3">{p}</p>
                        {!hasPhotoMarkers && i === photoInsertIdx - 1 && photos.length > 0 && renderPhotoGrid()}
                      </div>
                    );
                  })}

                  {paragraphs.length === 0 && photos.length > 0 && renderPhotoGrid()}

                  {previewHashtags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-[var(--border)]">
                      {previewHashtags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag.startsWith("#") ? tag : `#${tag}`}
                        </Badge>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Title AI */}
                  <div className="flex items-center justify-between mb-2">
                    <Button variant="ghost" size="sm" onClick={handleGenerateTitles} disabled={titlesLoading} className="text-xs h-9 min-h-[44px] px-3">
                      {titlesLoading ? "생성 중..." : "AI 제목 5개 추천"}
                    </Button>
                  </div>
                  {titleCandidates.length > 0 && (
                    <div className="space-y-1.5 mb-4">
                      {titleCandidates.map((c, i) => (
                        <button key={i} onClick={() => handleSelectTitle(c)} className="w-full text-left rounded-md border border-[var(--border)] hover:border-[var(--accent)] p-2.5 transition-colors">
                          <p className="text-xs font-medium text-[var(--text)]">{c.titleKo}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">{c.titleEn}</p>
                          <Badge variant="secondary" className="text-xs mt-1">{c.style}</Badge>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Side-by-side editing */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label className="text-xs text-[var(--accent)]">한국어</Label>
                      <div className="space-y-1.5">
                        <Label htmlFor="titleKo" className="text-xs">제목</Label>
                        <Input id="titleKo" value={titleKo} onChange={(e) => setTitleKo(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="contentKo" className="text-xs">본문</Label>
                        <Textarea id="contentKo" value={contentKo} onChange={(e) => setContentKo(e.target.value)} rows={8} className="font-mono text-sm leading-relaxed md:min-h-[350px]" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="hashtagsKo" className="text-xs">해시태그</Label>
                        <Input id="hashtagsKo" value={hashtagsKo} onChange={(e) => setHashtagsKo(e.target.value)} placeholder="#해시태그1 #해시태그2" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-xs text-blue-400">English</Label>
                      <div className="space-y-1.5">
                        <Label htmlFor="titleEn" className="text-xs">Title</Label>
                        <Input id="titleEn" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="contentEn" className="text-xs">Content</Label>
                        <Textarea id="contentEn" value={contentEn} onChange={(e) => setContentEn(e.target.value)} rows={8} className="font-mono text-sm leading-relaxed md:min-h-[350px]" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="hashtagsEn" className="text-xs">Hashtags</Label>
                        <Input id="hashtagsEn" value={hashtagsEn} onChange={(e) => setHashtagsEn(e.target.value)} placeholder="#hashtag1 #hashtag2" />
                      </div>
                    </div>
                  </div>

                  {/* Keywords */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>해시태그 (스페이스 구분)</Label>
                      <Button variant="ghost" size="sm" onClick={handleSuggestKeywords} disabled={keywordsLoading} className="text-xs h-9 min-h-[44px] px-3">
                        {keywordsLoading ? "분석 중..." : "AI 키워드 추천"}
                      </Button>
                    </div>
                    {lang === "ko"
                      ? <Input value={hashtagsKo} onChange={(e) => setHashtagsKo(e.target.value)} placeholder="#맛집 #서울" />
                      : <Input value={hashtagsEn} onChange={(e) => setHashtagsEn(e.target.value)} placeholder="#food #seoul" />}
                    {suggestedKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {suggestedKeywords.map((kw) => (
                          <button key={kw} onClick={() => handleAddKeyword(kw)} className="text-xs px-3 py-2 rounded-full border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors min-h-[44px]">
                            + {kw}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Partial Regeneration */}
                  <details className="rounded-lg border border-[var(--border)] overflow-hidden">
                    <summary className="px-4 py-3 text-sm font-medium text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors">
                      부분 재생성 도구
                    </summary>
                    <div className="border-t border-[var(--border)] p-3 space-y-2">
                      <p className="text-xs font-medium text-[var(--text-secondary)]">문단 부분 재생성</p>
                      <div className="space-y-2">
                        <select
                          value={regenIndex ?? ""}
                          onChange={(e) => { const v = e.target.value; setRegenIndex(v === "" ? null : parseInt(v, 10)); setRegenPreview(null); }}
                          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-3 py-1.5 text-xs"
                        >
                          <option value="">문단 선택...</option>
                          {(lang === "ko" ? contentKo : contentEn).split("\n\n").map((p, i) => (
                            <option key={i} value={i}>{i + 1}번 문단: {p.slice(0, 40)}...</option>
                          ))}
                        </select>
                        {regenIndex !== null && (
                          <>
                            <Input value={regenFeedback} onChange={(e) => setRegenFeedback(e.target.value)} placeholder="피드백 (예: 더 캐주얼하게, 맛 묘사를 자세히)" className="text-xs" />
                            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenLoading || !regenFeedback.trim()} className="w-full text-xs">
                              {regenLoading ? "재생성 중..." : "이 문단 다시 쓰기"}
                            </Button>
                            {regenPreview && (
                              <div className="space-y-2">
                                <div className="rounded-md bg-[var(--bg-elevated)] p-3 text-xs leading-relaxed">
                                  <p className="text-xs text-[var(--accent)] font-medium mb-1">재생성 결과:</p>
                                  {regenPreview}
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={handleApplyRegen} className="flex-1 text-xs">적용</Button>
                                  <Button variant="outline" size="sm" onClick={() => setRegenPreview(null)} className="flex-1 text-xs">취소</Button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </details>

                  {/* Save + Versions */}
                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={saving} className="flex-1">
                      {saving ? "저장 중..." : "수정 저장"}
                    </Button>
                    <Button variant="outline" onClick={handleLoadVersions} disabled={versionsLoading} className="text-xs">
                      {versionsLoading ? "..." : showVersions ? "닫기" : "버전 기록"}
                    </Button>
                  </div>
                  {showVersions && (
                    <div className="rounded-lg border border-[var(--border)] p-3 space-y-2 max-h-60 overflow-y-auto">
                      <p className="text-xs font-medium text-[var(--text-secondary)]">버전 히스토리</p>
                      {versions.length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)]">저장된 버전이 없습니다</p>
                      ) : (
                        versions.map((v) => (
                          <div key={v.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-[var(--border)] last:border-0">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-[var(--text)] truncate">{v.titleKo ?? "(제목 없음)"}</p>
                              <p className="text-xs text-[var(--text-muted)]">
                                {new Date(v.createdAt).toLocaleString("ko")} · {v.changeReason === "manual_edit" ? "수동 편집" : v.changeReason === "before_restore" ? "복원 전" : v.changeReason}
                              </p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleRestoreVersion(v.id)} className="text-xs h-9 min-h-[44px] px-3 shrink-0 text-[var(--accent)]">
                              복원
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Watermark */}
          {hasWatermarkText && photos.length > 0 && (
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">워터마크 적용</p>
                  <p className="text-xs text-[var(--text-muted)]">설정된 워터마크를 모든 사진에 적용합니다 ({photos.length}장)</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleApplyWatermark} disabled={watermarkApplying}>
                  {watermarkApplying ? "적용 중..." : "워터마크 적용"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* SEO Score */}
          {post?.status === "generated" && (
            <SeoAnalysisCard postId={postId} lang={lang} showToast={showToast} />
          )}

          {/* Photo Analysis */}
          {photos.length > 0 && (
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">AI 사진 분석</p>
                  <p className="text-xs text-[var(--text-muted)]">Vision AI로 사진 캡션을 자동 생성합니다 ({photos.length}장)</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleAnalyzePhotos} disabled={photoAnalyzing}>
                  {photoAnalyzing ? "분석 중..." : "AI 캡션 생성"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Platform Copy */}
          <PlatformCopyCard
            postId={postId}
            photos={photos}
            place={place}
            lang={lang}
            titleKo={titleKo}
            titleEn={titleEn}
            contentKo={contentKo}
            contentEn={contentEn}
            hashtagsKo={hashtagsKo}
            hashtagsEn={hashtagsEn}
            photoByIndex={photoByIndex}
            showToast={showToast}
            onOpenNaverModal={(html) => setNaverModalHtml(html)}
          />

          {/* Publish + Schedule + History */}
          {post && (
            <PublishScheduleCard
              postId={postId}
              post={post}
              lang={lang}
              connections={connections}
              publishHistory={publishHistory}
              onPublishHistoryUpdate={setPublishHistory}
              onPostUpdate={setPost}
              showToast={showToast}
            />
          )}

          {/* Competitor Analysis */}
          {post?.status === "generated" && (
            <CompetitorAnalysisCard postId={postId} lang={lang} showToast={showToast} />
          )}

          {/* Related Posts */}
          <RelatedPostsCard
            postId={postId}
            lang={lang}
            onInsertLink={(text) => {
              if (lang === "ko") setContentKo((prev) => prev + text);
              else setContentEn((prev) => prev + text);
            }}
            showToast={showToast}
          />

          <div className="text-center">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard" className="no-underline text-[var(--text-muted)]">대시보드로 돌아가기</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>

    {/* Naver Copy Modal */}
    {naverModalHtml && (
      <NaverCopyModal
        naverHtml={naverModalHtml}
        onClose={() => setNaverModalHtml(null)}
        showToast={showToast}
      />
    )}
    </>
  );
}
