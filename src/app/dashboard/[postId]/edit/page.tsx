"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Post = {
  id: number;
  titleKo: string | null;
  contentKo: string | null;
  hashtagsKo: string[];
  titleEn: string | null;
  contentEn: string | null;
  hashtagsEn: string[];
  status: string;
  generationError: string | null;
  placeId: number;
  scheduledAt: string | null;
  scheduledPlatform: string | null;
  scheduledLang: string | null;
};

type Photo = {
  id: number;
  filePath: string;
  caption: string | null;
  altText: string | null;
  orderIndex: number;
};

type Place = {
  id: number;
  name: string;
  category: string;
};

type PublishHistoryItem = {
  id: number;
  postId: number;
  platform: string;
  lang: string;
  publishedUrl: string | null;
  status: "published" | "failed" | "copied";
  error: string | null;
  publishedAt: string;
};

type Tab = "preview" | "edit";
type Lang = "ko" | "en";
type Platform = "naver" | "tistory" | "medium" | "wordpress";

const PLATFORM_LABELS: Record<Platform, string> = {
  naver: "네이버",
  tistory: "티스토리",
  medium: "Medium",
  wordpress: "WordPress",
};

const PLATFORM_COLORS: Record<string, string> = {
  naver: "bg-green-500/15 text-green-400 border-green-500/30",
  tistory: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-white/15 text-white border-white/30",
  wordpress: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

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
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [connections, setConnections] = useState<{ platform: string; hasToken: boolean }[]>([]);
  const [publishHistory, setPublishHistory] = useState<PublishHistoryItem[]>([]);

  // Watermark
  const [watermarkApplying, setWatermarkApplying] = useState(false);
  const [hasWatermarkText, setHasWatermarkText] = useState(false);

  // Scheduling
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [schedulePlatform, setSchedulePlatform] = useState<Platform>("tistory");
  const [scheduling, setScheduling] = useState(false);

  // Keywords
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [keywordsLoading, setKeywordsLoading] = useState(false);

  // SEO Score
  const [seoScore, setSeoScore] = useState<{
    score: number;
    grade: string;
    breakdown: { category: string; score: number; max: number; detail: string; tips: string[] }[];
  } | null>(null);
  const [seoLoading, setSeoLoading] = useState(false);

  // Partial Regeneration
  const [regenIndex, setRegenIndex] = useState<number | null>(null);
  const [regenFeedback, setRegenFeedback] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenPreview, setRegenPreview] = useState<string | null>(null);

  // Competitor Analysis
  const [competitors, setCompetitors] = useState<{
    benchmarks: { avgContentLength: string; avgPhotoCount: string; commonElements: string[] };
    missing: string[];
    strengths: string[];
    improvements: string[];
    competitiveScore: number;
  } | null>(null);
  const [competitorsLoading, setCompetitorsLoading] = useState(false);

  // Photo Analysis
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);

  // Title candidates
  const [titleCandidates, setTitleCandidates] = useState<{ titleKo: string; titleEn: string; style: string }[]>([]);
  const [titlesLoading, setTitlesLoading] = useState(false);

  // Version history
  const [versions, setVersions] = useState<{ id: number; titleKo: string | null; changeReason: string; createdAt: string }[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  // Related posts (internal links)
  const [relatedPosts, setRelatedPosts] = useState<{ id: number; titleKo: string | null; titleEn: string | null; placeName: string; placeCategory: string }[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

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

    // Fetch platform connections
    fetch("/api/connections")
      .then((r) => (r.ok ? r.json() : { connections: [] }))
      .then((data) => setConnections(data.connections ?? []))
      .catch(() => {});

    // Fetch profile for watermark config
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : { profile: null }))
      .then((data) => setHasWatermarkText(!!data.profile?.watermarkText))
      .catch(() => {});
  }, [postId]);

  // ── Save ──
  const handleSave = async () => {
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

  // ── Platform copy formatters ──
  const getTitle = () => lang === "ko" ? titleKo : titleEn;
  const getContent = () => lang === "ko" ? contentKo : contentEn;
  const getHashtags = () => (lang === "ko" ? hashtagsKo : hashtagsEn).split(/\s+/).filter(Boolean);
  const getTagStr = () => getHashtags().map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");

  const getPhotoAlt = (p: Photo) => p.altText ?? p.caption ?? `Photo ${p.orderIndex}`;

  const buildPhotoImgTags = (format: "html" | "markdown"): string => {
    if (photos.length === 0) return "";
    if (format === "html") {
      return photos
        .map((p) => {
          const alt = getPhotoAlt(p);
          return `<img src="${p.filePath}" alt="${alt}" style="max-width:100%;margin:12px 0;" />${p.caption ? `\n<p style="text-align:center;color:#888;font-size:14px;">${p.caption}</p>` : ""}`;
        })
        .join("\n");
    }
    // markdown
    return photos
      .map((p) => `![${getPhotoAlt(p)}](${p.filePath})${p.caption ? `\n*${p.caption}*` : ""}`)
      .join("\n\n");
  };

  const replacePhotoMarkers = (text: string, format: "html" | "markdown"): string => {
    return text.replace(/\[PHOTO:(\d+)\]/g, (_match, idxStr) => {
      const idx = parseInt(idxStr, 10);
      const photo = photoByIndex.get(idx);
      if (!photo) return "";
      if (format === "html") {
        const alt = getPhotoAlt(photo);
        return `<img src="${photo.filePath}" alt="${alt}" style="max-width:100%;margin:12px 0;" />${photo.caption ? `\n<p style="text-align:center;color:#888;font-size:14px;">${photo.caption}</p>` : ""}`;
      }
      return `![${getPhotoAlt(photo)}](${photo.filePath})${photo.caption ? `\n*${photo.caption}*` : ""}`;
    });
  };

  const formatNaver = (title: string, htmlParts: string[], tagStr: string): string => {
    const header = `<div style="text-align:center;margin-bottom:30px;">
<h2 style="font-size:22px;font-weight:bold;">${title}</h2>
<hr style="border:none;border-top:1px solid #ddd;margin:20px 0;" />
</div>`;
    const footer = `<hr style="border:none;border-top:1px solid #ddd;margin:30px 0 15px;" />
<p style="color:#888;font-size:14px;">${tagStr}</p>
${place ? `<p style="color:#888;font-size:13px;margin-top:8px;">📍 ${place.name}${place.category ? ` | ${place.category}` : ""}</p>` : ""}`;
    return `${header}\n${htmlParts.join("\n\n")}\n\n${footer}`;
  };

  const formatTistory = (title: string, htmlParts: string[], tagStr: string): string => {
    const header = `<h2 style="text-align:center;">${title}</h2>
<p>&nbsp;</p>`;
    const body = htmlParts.map((part) => {
      if (part.startsWith("<img ")) return `<div style="text-align:center;">${part}</div>`;
      return part;
    }).join("\n\n<p>&nbsp;</p>\n\n");
    const footer = `<p>&nbsp;</p>
<hr />
<p style="color:#888;font-size:14px;">${tagStr}</p>
${place ? `<p style="color:#888;font-size:13px;">📍 ${place.name}${place.category ? ` | ${place.category}` : ""}</p>` : ""}`;
    return `${header}\n\n${body}\n\n${footer}`;
  };

  const formatForPlatform = (platform: Platform): string => {
    const title = getTitle();
    const content = getContent();
    const tagStr = getTagStr();
    const contentHasMarkers = /\[PHOTO:\d+\]/.test(content);
    const format = (platform === "naver" || platform === "tistory") ? "html" : "markdown";

    if (contentHasMarkers) {
      // Replace [PHOTO:n] markers with actual image tags
      const replaced = replacePhotoMarkers(content, format);
      if (platform === "naver" || platform === "tistory") {
        const htmlParts = replaced.split("\n\n").map((p) => {
          if (p.startsWith("<img ")) return p;
          return `<p style="font-size:16px;line-height:1.8;margin-bottom:20px;">${p}</p>`;
        });
        if (platform === "tistory") return formatTistory(title, htmlParts, tagStr);
        return formatNaver(title, htmlParts, tagStr);
      }
      return `# ${title}\n\n${replaced}\n\n${tagStr}`;
    }

    // Fallback: insert all photos after first paragraph
    const contentParagraphs = content.split("\n\n");
    const photoBlock = buildPhotoImgTags(format);
    const insertIdx = Math.min(1, contentParagraphs.length);

    if (platform === "naver" || platform === "tistory") {
      const htmlParts = contentParagraphs.map((p) => `<p style="font-size:16px;line-height:1.8;margin-bottom:20px;">${p}</p>`);
      htmlParts.splice(insertIdx, 0, photoBlock);
      if (platform === "tistory") return formatTistory(title, htmlParts, tagStr);
      return formatNaver(title, htmlParts, tagStr);
    }
    const mdParts = [...contentParagraphs];
    mdParts.splice(insertIdx, 0, photoBlock);
    return `# ${title}\n\n${mdParts.join("\n\n")}\n\n${tagStr}`;
  };

  const handleCopy = async (platform: Platform) => {
    const text = formatForPlatform(platform);
    await navigator.clipboard.writeText(text);
    showToast(`${PLATFORM_LABELS[platform]} 포맷 복사됨!`);
    // Record copy in publish history
    if (platform === "naver" || platform === "tistory") {
      try {
        await fetch(`/api/posts/${postId}/record-copy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, lang }),
        });
        // Refresh publish history
        const res = await fetch(`/api/posts/${postId}`);
        if (res.ok) {
          const data = await res.json();
          setPublishHistory(data.publishHistory ?? []);
        }
      } catch { /* non-critical */ }
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
      if (!current.includes(keyword)) {
        setHashtagsKo([...current, keyword].join(" "));
      }
    } else {
      const current = hashtagsEn.split(/\s+/).filter(Boolean);
      if (!current.includes(keyword)) {
        setHashtagsEn([...current, keyword].join(" "));
      }
    }
    setSuggestedKeywords((prev) => prev.filter((k) => k !== keyword));
    showToast(`${keyword} 추가됨`);
  };

  const handleSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      showToast("날짜와 시간을 선택해주세요");
      return;
    }
    setScheduling(true);
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      const res = await fetch(`/api/posts/${postId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt, platform: schedulePlatform, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Schedule failed");
      setPost(data.post);
      showToast("예약 발행이 설정되었습니다!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "예약 설정 실패");
    } finally {
      setScheduling(false);
    }
  };

  const handleUnschedule = async () => {
    setScheduling(true);
    try {
      const res = await fetch(`/api/posts/${postId}/schedule`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unschedule failed");
      setPost(data.post);
      setScheduleDate("");
      setScheduleTime("");
      showToast("예약이 취소되었습니다");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "예약 취소 실패");
    } finally {
      setScheduling(false);
    }
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
      // Update photo paths locally
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

  // ── SEO Score ──
  const handleFetchSeoScore = async () => {
    setSeoLoading(true);
    setSeoScore(null);
    try {
      const res = await fetch(`/api/posts/${postId}/seo-score?lang=${lang}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSeoScore(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "SEO 분석 실패");
    } finally {
      setSeoLoading(false);
    }
  };

  // ── Partial Regeneration ──
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

  // ── Competitor Analysis ──
  const handleFetchCompetitors = async () => {
    setCompetitorsLoading(true);
    setCompetitors(null);
    try {
      const res = await fetch(`/api/posts/${postId}/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setCompetitors(data.analysis);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "경쟁 분석 실패");
    } finally {
      setCompetitorsLoading(false);
    }
  };

  // ── Title Candidates ──
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

  // ── Version History ──
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

  // ── Related Posts ──
  const handleLoadRelated = async () => {
    setRelatedLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/related`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setRelatedPosts(data.related ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "관련 글 로드 실패");
    } finally {
      setRelatedLoading(false);
    }
  };

  // ── Photo Analysis ──
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

  const hasMediumConnection = connections.some((c) => c.platform === "medium" && c.hasToken);
  const hasWordPressConfig = typeof window !== "undefined"; // WordPress uses env vars, always show button

  const handlePublish = async (platform: "medium" | "wordpress") => {
    setPublishing(true);
    setPublishedUrl(null);
    try {
      const res = await fetch(`/api/publish/${platform}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: parseInt(postId, 10), lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Publish failed");
      setPublishedUrl(data.url ?? null);
      showToast(`${PLATFORM_LABELS[platform]}에 발행 완료!`);
      // Refresh publish history
      const histRes = await fetch(`/api/posts/${postId}`);
      if (histRes.ok) {
        const histData = await histRes.json();
        setPublishHistory(histData.publishHistory ?? []);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "발행 실패");
    } finally {
      setPublishing(false);
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

  // Split content into paragraphs — detect [PHOTO:n] markers for smart placement
  const paragraphs = previewContent ? previewContent.split("\n\n") : [];
  const hasPhotoMarkers = /\[PHOTO:\d+\]/.test(previewContent);
  const photoInsertIdx = hasPhotoMarkers ? -1 : Math.min(1, paragraphs.length);

  // Build photo lookup by orderIndex
  const photoByIndex = new Map(photos.map((p) => [p.orderIndex, p]));

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

  return (
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
              {place && (
                <p className="text-sm text-[var(--text-muted)] mt-1">{place.name}</p>
              )}
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
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
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
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
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

          {/* Content */}
          <Card>
            <CardContent className="p-6 space-y-4">
              {tab === "preview" ? (
                <>
                  <h2 className="text-xl font-bold">{previewTitle || "(제목 없음)"}</h2>

                  {/* Interleave paragraphs with photos */}
                  {paragraphs.length === 0 && photos.length === 0 && (
                    <p className="text-sm text-[var(--text-muted)]">(내용 없음)</p>
                  )}

                  {paragraphs.map((p, i) => {
                    // Check if this paragraph is a photo marker
                    const markerMatch = p.trim().match(/^\[PHOTO:\d+\]$/);
                    if (hasPhotoMarkers && markerMatch) {
                      return <div key={i}>{renderPhotoByMarker(p.trim())}</div>;
                    }

                    return (
                      <div key={i}>
                        <p className="text-sm leading-relaxed text-[var(--text-secondary)] mb-3">{p}</p>

                        {/* Fallback: insert all photos after first paragraph if no markers */}
                        {!hasPhotoMarkers && i === photoInsertIdx - 1 && photos.length > 0 && (
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
                        )}
                      </div>
                    );
                  })}

                  {/* If no paragraphs, still show photos */}
                  {paragraphs.length === 0 && photos.length > 0 && (
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
                  )}

                  {/* Hashtags */}
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
                  {/* Side-by-side editing: KO left, EN right on desktop */}
                  <div className="flex items-center justify-between mb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerateTitles}
                      disabled={titlesLoading}
                      className="text-xs h-8 px-3"
                    >
                      {titlesLoading ? "생성 중..." : "AI 제목 3개 추천"}
                    </Button>
                  </div>
                  {titleCandidates.length > 0 && (
                    <div className="space-y-1.5 mb-4">
                      {titleCandidates.map((c, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectTitle(c)}
                          className="w-full text-left rounded-md border border-[var(--border)] hover:border-[var(--accent)] p-2.5 transition-colors"
                        >
                          <p className="text-xs font-medium text-[var(--text)]">{c.titleKo}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">{c.titleEn}</p>
                          <Badge variant="secondary" className="text-xs mt-1">{c.style}</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Korean */}
                    <div className="space-y-3">
                      <Label className="text-xs text-[var(--accent)]">한국어</Label>
                      <div className="space-y-1.5">
                        <Label htmlFor="titleKo" className="text-xs">제목</Label>
                        <Input id="titleKo" value={titleKo} onChange={(e) => setTitleKo(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="contentKo" className="text-xs">본문</Label>
                        <Textarea id="contentKo" value={contentKo} onChange={(e) => setContentKo(e.target.value)} rows={14} className="font-mono text-sm leading-relaxed" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="hashtagsKo" className="text-xs">해시태그</Label>
                        <Input id="hashtagsKo" value={hashtagsKo} onChange={(e) => setHashtagsKo(e.target.value)} placeholder="#해시태그1 #해시태그2" />
                      </div>
                    </div>
                    {/* English */}
                    <div className="space-y-3">
                      <Label className="text-xs text-blue-400">English</Label>
                      <div className="space-y-1.5">
                        <Label htmlFor="titleEn" className="text-xs">Title</Label>
                        <Input id="titleEn" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="contentEn" className="text-xs">Content</Label>
                        <Textarea id="contentEn" value={contentEn} onChange={(e) => setContentEn(e.target.value)} rows={14} className="font-mono text-sm leading-relaxed" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="hashtagsEn" className="text-xs">Hashtags</Label>
                        <Input id="hashtagsEn" value={hashtagsEn} onChange={(e) => setHashtagsEn(e.target.value)} placeholder="#hashtag1 #hashtag2" />
                      </div>
                    </div>
                  </div>
                  {/* Advanced Tools (collapsible) */}
                  <details className="rounded-lg border border-[var(--border)] overflow-hidden">
                    <summary className="px-4 py-3 text-sm font-medium text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors">
                      추가 도구 (부분 재생성, 키워드, 버전 히스토리)
                    </summary>

                  {/* Partial Regeneration */}
                  <div className="border-t border-[var(--border)] p-3 space-y-2">
                    <p className="text-xs font-medium text-[var(--text-secondary)]">문단 부분 재생성</p>
                    <div className="space-y-2">
                      <select
                        value={regenIndex ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRegenIndex(v === "" ? null : parseInt(v, 10));
                          setRegenPreview(null);
                        }}
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-3 py-1.5 text-xs"
                      >
                        <option value="">문단 선택...</option>
                        {(lang === "ko" ? contentKo : contentEn).split("\n\n").map((p, i) => (
                          <option key={i} value={i}>
                            {i + 1}번 문단: {p.slice(0, 40)}...
                          </option>
                        ))}
                      </select>
                      {regenIndex !== null && (
                        <>
                          <Input
                            value={regenFeedback}
                            onChange={(e) => setRegenFeedback(e.target.value)}
                            placeholder="피드백 (예: 더 캐주얼하게, 맛 묘사를 자세히)"
                            className="text-xs"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRegenerate}
                            disabled={regenLoading || !regenFeedback.trim()}
                            className="w-full text-xs"
                          >
                            {regenLoading ? "재생성 중..." : "이 문단 다시 쓰기"}
                          </Button>
                          {regenPreview && (
                            <div className="space-y-2">
                              <div className="rounded-md bg-[var(--bg-elevated)] p-3 text-xs leading-relaxed">
                                <p className="text-xs text-[var(--accent)] font-medium mb-1">재생성 결과:</p>
                                {regenPreview}
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={handleApplyRegen} className="flex-1 text-xs">
                                  적용
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setRegenPreview(null)}
                                  className="flex-1 text-xs"
                                >
                                  취소
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>해시태그 (스페이스 구분)</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSuggestKeywords}
                        disabled={keywordsLoading}
                        className="text-xs h-8 px-3"
                      >
                        {keywordsLoading ? "분석 중..." : "AI 키워드 추천"}
                      </Button>
                    </div>
                    {lang === "ko"
                      ? <Input value={hashtagsKo} onChange={(e) => setHashtagsKo(e.target.value)} placeholder="#맛집 #서울" />
                      : <Input value={hashtagsEn} onChange={(e) => setHashtagsEn(e.target.value)} placeholder="#food #seoul" />}
                    {suggestedKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {suggestedKeywords.map((kw) => (
                          <button
                            key={kw}
                            onClick={() => handleAddKeyword(kw)}
                            className="text-xs px-2 py-1 rounded-full border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
                          >
                            + {kw}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  </details>

                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={saving} className="flex-1">
                      {saving ? "저장 중..." : "수정 저장"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleLoadVersions}
                      disabled={versionsLoading}
                      className="text-xs"
                    >
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRestoreVersion(v.id)}
                              className="text-xs h-8 px-3 shrink-0 text-[var(--accent)]"
                            >
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
                  <p className="text-xs text-[var(--text-muted)]">
                    설정된 워터마크를 모든 사진에 적용합니다 ({photos.length}장)
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleApplyWatermark}
                  disabled={watermarkApplying}
                >
                  {watermarkApplying ? "적용 중..." : "워터마크 적용"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* SEO Score */}
          {post?.status === "generated" && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">SEO 점수</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFetchSeoScore}
                    disabled={seoLoading}
                  >
                    {seoLoading ? "분석 중..." : seoScore ? "다시 분석" : "분석하기"}
                  </Button>
                </div>
              </CardHeader>
              {seoScore && (
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "text-3xl font-bold w-16 h-16 rounded-full flex items-center justify-center border-2",
                      seoScore.grade === "A" ? "border-green-500 text-green-400" :
                      seoScore.grade === "B" ? "border-blue-500 text-blue-400" :
                      seoScore.grade === "C" ? "border-yellow-500 text-yellow-400" :
                      "border-red-500 text-red-400",
                    )}>
                      {seoScore.grade}
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{seoScore.score}점</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {seoScore.score >= 85 ? "훌륭합니다!" :
                         seoScore.score >= 70 ? "양호합니다" :
                         seoScore.score >= 50 ? "개선이 필요합니다" : "많은 개선이 필요합니다"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {seoScore.breakdown.map((item, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--text-secondary)]">{item.category}</span>
                          <span className="text-[var(--text-muted)]">{item.detail} ({item.score}/{item.max})</span>
                        </div>
                        <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              item.score / item.max >= 0.8 ? "bg-green-500" :
                              item.score / item.max >= 0.5 ? "bg-yellow-500" : "bg-red-500",
                            )}
                            style={{ width: `${(item.score / item.max) * 100}%` }}
                          />
                        </div>
                        {item.tips.length > 0 && (
                          <p className="text-xs text-[var(--text-muted)]">{item.tips[0]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Photo Analysis */}
          {photos.length > 0 && (
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">AI 사진 분석</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Vision AI로 사진 캡션을 자동 생성합니다 ({photos.length}장)
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyzePhotos}
                  disabled={photoAnalyzing}
                >
                  {photoAnalyzing ? "분석 중..." : "AI 캡션 생성"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Platform Copy */}
          <Card>
            <CardHeader><CardTitle className="text-lg">플랫폼별 복사</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-[var(--text-muted)]">사진 img 태그와 해시태그가 포함됩니다</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Button variant="outline" onClick={() => handleCopy("naver")} className="w-full">
                    네이버 복사 (HTML)
                  </Button>
                  <p className="text-xs text-[var(--text-muted)] text-center">에디터 최적화 포맷</p>
                </div>
                <div className="space-y-1">
                  <Button variant="outline" onClick={() => handleCopy("tistory")} className="w-full">
                    티스토리 복사 (HTML)
                  </Button>
                  <p className="text-xs text-[var(--text-muted)] text-center">HTML 모드에 붙여넣기</p>
                </div>
                <Button variant="outline" onClick={() => handleCopy("medium")} className="w-full">
                  Medium 복사 (MD)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Auto Publish */}
          <Card>
            <CardHeader><CardTitle className="text-lg">자동 발행</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Button
                    variant="outline"
                    onClick={() => handlePublish("medium")}
                    disabled={publishing}
                    className="w-full"
                  >
                    {publishing ? "발행 중..." : "Medium에 발행"}
                  </Button>
                  {hasMediumConnection ? (
                    <p className="text-xs text-green-500 text-center">연동됨</p>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] text-center">
                      <Link href="/dashboard/settings" className="text-[var(--accent)] hover:underline">설정에서 연동</Link>
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Button
                    variant="outline"
                    onClick={() => handlePublish("wordpress")}
                    disabled={publishing}
                    className="w-full"
                  >
                    {publishing ? "발행 중..." : "WordPress에 발행"}
                  </Button>
                  <p className="text-xs text-[var(--text-muted)] text-center">환경변수 설정 필요</p>
                </div>
              </div>
              {publishedUrl && (
                <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm">
                  <p className="text-green-400 text-xs mb-1">발행 완료!</p>
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] text-xs hover:underline break-all"
                  >
                    {publishedUrl}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schedule Publish */}
          {post?.status === "generated" && (
            <Card>
              <CardHeader><CardTitle className="text-lg">예약 발행</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {post.scheduledAt ? (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-[var(--accent-soft)] border border-[var(--accent)]/30 px-4 py-3">
                      <p className="text-sm font-medium">예약됨</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        {new Date(post.scheduledAt).toLocaleString("ko-KR", {
                          year: "numeric", month: "long", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                        {" · "}
                        {PLATFORM_LABELS[post.scheduledPlatform as Platform] ?? post.scheduledPlatform}
                        {" · "}
                        {post.scheduledLang === "ko" ? "한국어" : "English"}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleUnschedule}
                      disabled={scheduling}
                    >
                      {scheduling ? "취소 중..." : "예약 취소"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>날짜</Label>
                        <Input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>시간</Label>
                        <Input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>발행 플랫폼</Label>
                      <select
                        value={schedulePlatform}
                        onChange={(e) => setSchedulePlatform(e.target.value as Platform)}
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm"
                      >
                        <option value="tistory">티스토리</option>
                        <option value="medium">Medium</option>
                        <option value="wordpress">WordPress</option>
                      </select>
                    </div>
                    <Button
                      onClick={handleSchedule}
                      disabled={scheduling || !scheduleDate || !scheduleTime}
                      className="w-full"
                    >
                      {scheduling ? "설정 중..." : "예약 발행 설정"}
                    </Button>
                    <p className="text-xs text-[var(--text-muted)]">
                      현재 선택된 언어({lang === "ko" ? "한국어" : "English"})로 발행됩니다
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Publish History */}
          {publishHistory.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">발행 이력</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {publishHistory.map((h) => (
                    <div key={h.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-xs border", PLATFORM_COLORS[h.platform] ?? "")}>
                          {PLATFORM_LABELS[h.platform as Platform] ?? h.platform}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {h.lang === "ko" ? "한국어" : "English"}
                        </Badge>
                        {h.status === "published" && (
                          <span className="text-xs text-green-400">발행됨</span>
                        )}
                        {h.status === "copied" && (
                          <span className="text-xs text-blue-400">복사됨</span>
                        )}
                        {h.status === "failed" && (
                          <span className="text-xs text-red-400">실패</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {h.publishedUrl && (
                          <a href={h.publishedUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-[var(--accent)] hover:underline">
                            열기
                          </a>
                        )}
                        <span className="text-xs text-[var(--text-muted)]">
                          {new Date(h.publishedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Competitor Analysis */}
          {post?.status === "generated" && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">경쟁 글 분석</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFetchCompetitors}
                    disabled={competitorsLoading}
                  >
                    {competitorsLoading ? "분석 중..." : competitors ? "다시 분석" : "분석하기"}
                  </Button>
                </div>
              </CardHeader>
              {competitors && (
                <CardContent className="space-y-4">
                  {/* Competitive Score */}
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "text-2xl font-bold w-12 h-12 rounded-full flex items-center justify-center border-2",
                      competitors.competitiveScore >= 8 ? "border-green-500 text-green-400" :
                      competitors.competitiveScore >= 6 ? "border-blue-500 text-blue-400" :
                      competitors.competitiveScore >= 4 ? "border-yellow-500 text-yellow-400" :
                      "border-red-500 text-red-400",
                    )}>
                      {competitors.competitiveScore}
                    </div>
                    <div>
                      <p className="text-sm font-medium">경쟁력 점수</p>
                      <p className="text-xs text-[var(--text-muted)]">상위 글 대비 10점 만점</p>
                    </div>
                  </div>

                  {/* Benchmarks */}
                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3 space-y-1.5">
                    <p className="text-xs font-medium">상위 글 기준</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      평균 글자수: {competitors.benchmarks.avgContentLength} | 평균 사진: {competitors.benchmarks.avgPhotoCount}
                    </p>
                    {competitors.benchmarks.commonElements.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {competitors.benchmarks.commonElements.map((el, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{el}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Strengths */}
                  {competitors.strengths.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-green-400">강점</p>
                      {competitors.strengths.map((s, i) => (
                        <p key={i} className="text-xs text-[var(--text-secondary)] pl-2 border-l-2 border-green-500/30">{s}</p>
                      ))}
                    </div>
                  )}

                  {/* Missing */}
                  {competitors.missing.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-yellow-400">부족한 요소</p>
                      {competitors.missing.map((m, i) => (
                        <p key={i} className="text-xs text-[var(--text-secondary)] pl-2 border-l-2 border-yellow-500/30">{m}</p>
                      ))}
                    </div>
                  )}

                  {/* Improvements */}
                  {competitors.improvements.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-[var(--accent)]">개선 제안</p>
                      {competitors.improvements.map((imp, i) => (
                        <p key={i} className="text-xs text-[var(--text-secondary)] pl-2 border-l-2 border-[var(--accent)]/30">{imp}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* Related Posts (Internal Links) */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">관련 글 추천</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadRelated}
                  disabled={relatedLoading}
                  className="text-xs"
                >
                  {relatedLoading ? "검색 중..." : "관련 글 찾기"}
                </Button>
              </div>
            </CardHeader>
            {relatedPosts.length > 0 && (
              <CardContent className="space-y-2">
                <p className="text-xs text-[var(--text-muted)]">같은 카테고리/지역의 내 글 — 본문에 내부 링크로 활용하세요</p>
                {relatedPosts.map((rp) => (
                  <div key={rp.id} className="flex items-center gap-2 py-1.5 border-b border-[var(--border)] last:border-0">
                    <div className="min-w-0 flex-1">
                      <Link href={`/dashboard/${rp.id}/edit`} className="text-xs text-[var(--accent)] hover:underline truncate block">
                        {rp.titleKo ?? rp.placeName}
                      </Link>
                      <p className="text-xs text-[var(--text-muted)]">{rp.placeName}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const linkText = lang === "ko"
                          ? `\n\n👉 이 근처 다른 곳도 다녀왔어요: ${rp.titleKo ?? rp.placeName}`
                          : `\n\n👉 Also nearby: ${rp.titleEn ?? rp.placeName}`;
                        if (lang === "ko") setContentKo((prev) => prev + linkText);
                        else setContentEn((prev) => prev + linkText);
                        showToast("관련 글 링크가 본문 끝에 추가되었습니다. 저장해주세요.");
                      }}
                      className="text-xs h-8 px-3 shrink-0"
                    >
                      삽입
                    </Button>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          <div className="text-center">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard" className="no-underline text-[var(--text-muted)]">대시보드로 돌아가기</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
