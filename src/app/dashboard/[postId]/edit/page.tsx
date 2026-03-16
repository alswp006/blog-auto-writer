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
import { SeoScoreCard } from "@/components/post/seo-score-card";
import { CompetitorAnalysisCard } from "@/components/post/competitor-analysis-card";
import { PublishHistoryCard, type PublishHistoryItem } from "@/components/post/publish-history-card";
import { SchedulePublishCard } from "@/components/post/schedule-publish-card";
import { PlatformOptimizeCard } from "@/components/post/platform-optimize-card";

type GenerationMeta = {
  mainModel: string;
  visionProvider: string;
  visionModel: string;
  researchProvider: string;
  styleContextPosts: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
};

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
  generationMeta: GenerationMeta | null;
  placeId: number;
  scheduledAt: string | null;
  scheduledPlatform: string | null;
  scheduledLang: string | null;
};

type Photo = {
  id: number;
  filePath: string;
  caption: string | null;
  orderIndex: number;
};

type Place = {
  id: number;
  name: string;
  category: string;
};

type PostVariant = {
  id: number;
  postId: number;
  platform: "naver" | "tistory" | "medium";
  lang: "ko" | "en";
  title: string;
  content: string;
  hashtags: string[];
  createdAt: string;
  updatedAt: string;
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

  // Face Mosaic
  const [faceMosaicApplying, setFaceMosaicApplying] = useState(false);

  // Platform Variants
  const [variants, setVariants] = useState<PostVariant[]>([]);
  const [activeVariant, setActiveVariant] = useState<"base" | "naver" | "tistory" | "medium">("base");

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
        setVariants(data.variants ?? []);
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

  const buildPhotoImgTags = (format: "html" | "markdown"): string => {
    if (photos.length === 0) return "";
    if (format === "html") {
      return photos
        .map((p) => {
          const alt = p.caption ?? `Photo ${p.orderIndex}`;
          return `<img src="${p.filePath}" alt="${alt}" style="max-width:100%;margin:12px 0;" />${p.caption ? `\n<p style="text-align:center;color:#888;font-size:14px;">${p.caption}</p>` : ""}`;
        })
        .join("\n");
    }
    // markdown
    return photos
      .map((p) => `![${p.caption ?? `Photo ${p.orderIndex}`}](${p.filePath})${p.caption ? `\n*${p.caption}*` : ""}`)
      .join("\n\n");
  };

  const replacePhotoMarkers = (text: string, format: "html" | "markdown"): string => {
    return text.replace(/\[PHOTO:(\d+)\]/g, (_match, idxStr) => {
      const idx = parseInt(idxStr, 10);
      const photo = photoByIndex.get(idx);
      if (!photo) return "";
      if (format === "html") {
        const alt = photo.caption ?? `Photo ${photo.orderIndex}`;
        return `<img src="${photo.filePath}" alt="${alt}" style="max-width:100%;margin:12px 0;" />${photo.caption ? `\n<p style="text-align:center;color:#888;font-size:14px;">${photo.caption}</p>` : ""}`;
      }
      return `![${photo.caption ?? `Photo ${photo.orderIndex}`}](${photo.filePath})${photo.caption ? `\n*${photo.caption}*` : ""}`;
    });
  };

  const formatForPlatform = (platform: Platform): string => {
    // Use variant content if available for this platform+lang
    const variantPlatform = platform === "wordpress" ? null : platform;
    const variant = variantPlatform ? variants.find((v) => v.platform === variantPlatform && v.lang === lang) : null;
    const title = variant ? variant.title : getTitle();
    const content = variant ? variant.content : getContent();
    const tagStr = variant
      ? variant.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
      : getTagStr();
    // Naver: plain text (just paste into editor)
    if (platform === "naver") {
      const cleanContent = content.replace(/\[PHOTO:\d+\]\s*/g, "").trim();
      return `${title}\n\n${cleanContent}\n\n${tagStr}`;
    }

    // Other platforms: markdown with photo markers
    const contentHasMarkers = /\[PHOTO:\d+\]/.test(content);

    if (contentHasMarkers) {
      const replaced = replacePhotoMarkers(content, "markdown");
      return `# ${title}\n\n${replaced}\n\n${tagStr}`;
    }

    const paragraphs = content.split("\n\n");
    const photoBlock = buildPhotoImgTags("markdown");
    const insertIdx = Math.min(1, paragraphs.length);
    const mdParts = [...paragraphs];
    mdParts.splice(insertIdx, 0, photoBlock);
    return `# ${title}\n\n${mdParts.join("\n\n")}\n\n${tagStr}`;
  };

  // Convert photo to base64 data URI for rich clipboard
  const photoToDataUri = async (photo: Photo): Promise<string | null> => {
    try {
      const res = await fetch(photo.filePath);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // Build rich HTML with base64 images for Naver clipboard
  const buildNaverRichHtml = async (): Promise<string> => {
    const variantPlatform = "naver" as const;
    const variant = variants.find((v) => v.platform === variantPlatform && v.lang === lang);
    const title = variant ? variant.title : getTitle();
    const content = variant ? variant.content : getContent();
    const tagStr = variant
      ? variant.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
      : getTagStr();

    // Pre-load all photo data URIs
    const dataUriMap = new Map<number, string>();
    for (const photo of photos) {
      const dataUri = await photoToDataUri(photo);
      if (dataUri) dataUriMap.set(photo.orderIndex, dataUri);
    }

    const hasMarkers = /\[PHOTO:\d+\]/.test(content);

    // Replace [PHOTO:n] markers with <img> tags using data URIs
    let htmlBody: string;
    if (hasMarkers) {
      htmlBody = content.replace(/\[PHOTO:(\d+)\]/g, (_m, idxStr) => {
        const idx = parseInt(idxStr, 10);
        const dataUri = dataUriMap.get(idx);
        const photo = photoByIndex.get(idx);
        if (!dataUri) return "";
        const alt = photo?.caption ?? `Photo ${idx}`;
        let img = `<img src="${dataUri}" alt="${alt}" style="max-width:100%;margin:12px 0;" />`;
        if (photo?.caption) {
          img += `<p style="text-align:center;color:#888;font-size:14px;">${photo.caption}</p>`;
        }
        return img;
      });
    } else {
      // No markers — insert all photos after first paragraph
      htmlBody = content;
      if (dataUriMap.size > 0) {
        const paragraphs = content.split("\n\n");
        const insertIdx = Math.min(1, paragraphs.length);
        const photoHtml = photos
          .map((p) => {
            const dataUri = dataUriMap.get(p.orderIndex);
            if (!dataUri) return "";
            const alt = p.caption ?? `Photo ${p.orderIndex}`;
            return `<img src="${dataUri}" alt="${alt}" style="max-width:100%;margin:12px 0;" />`;
          })
          .filter(Boolean)
          .join("\n");
        paragraphs.splice(insertIdx, 0, photoHtml);
        htmlBody = paragraphs.join("\n\n");
      }
    }

    // Convert paragraphs to <p> tags (skip img blocks)
    const htmlParts = htmlBody.split("\n\n").map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<img ") || trimmed.startsWith("<p")) return trimmed;
      return `<p>${trimmed}</p>`;
    });

    return `<h2>${title}</h2>\n${htmlParts.join("\n")}\n<p>${tagStr}</p>`;
  };

  const handleCopy = async (platform: Platform) => {
    if (platform === "naver") {
      // Rich HTML copy with embedded images
      try {
        showToast("사진 포함 복사 중...");
        const html = await buildNaverRichHtml();
        const plainText = formatForPlatform(platform);

        const htmlBlob = new Blob([html], { type: "text/html" });
        const textBlob = new Blob([plainText], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": htmlBlob,
            "text/plain": textBlob,
          }),
        ]);
        showToast("네이버 복사 완료! (사진 포함)");
      } catch {
        // Fallback to plain text if rich clipboard fails
        const text = formatForPlatform(platform);
        await navigator.clipboard.writeText(text);
        showToast("네이버 복사됨 (텍스트만 — 브라우저가 이미지 복사를 지원하지 않습니다)");
      }

      // Record copy
      try {
        await fetch(`/api/posts/${postId}/record-copy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform: "naver", lang }),
        });
        const res = await fetch(`/api/posts/${postId}`);
        if (res.ok) {
          const data = await res.json();
          setPublishHistory(data.publishHistory ?? []);
        }
      } catch { /* non-critical */ }
      return;
    }

    // Other platforms: plain text markdown
    const text = formatForPlatform(platform);
    await navigator.clipboard.writeText(text);
    showToast(`${PLATFORM_LABELS[platform]} 포맷 복사됨!`);
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

  // ── Face Mosaic ──
  const handleFaceMosaic = async () => {
    if (photos.length === 0) return;
    setFaceMosaicApplying(true);
    try {
      const res = await fetch("/api/photos/face-mosaic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: photos.map((p) => p.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const resultMap = new Map(
        (data.results as { photoId: number; filePath: string }[]).map((r) => [r.photoId, r.filePath]),
      );
      setPhotos((prev) =>
        prev.map((p) => {
          const newPath = resultMap.get(p.id);
          return newPath ? { ...p, filePath: newPath } : p;
        }),
      );
      if (data.totalFaces > 0) {
        showToast(`얼굴 ${data.totalFaces}개 모자이크 완료! (${data.processed}장)`);
      } else {
        showToast("감지된 얼굴이 없습니다");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "얼굴 모자이크 실패");
    } finally {
      setFaceMosaicApplying(false);
    }
  };

  const hasTistoryConnection = connections.some((c) => c.platform === "tistory" && c.hasToken);
  const hasMediumConnection = connections.some((c) => c.platform === "medium" && c.hasToken);
  const hasWordPressConfig = typeof window !== "undefined"; // WordPress uses env vars, always show button

  const handlePublish = async (platform: "tistory" | "medium" | "wordpress") => {
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
  const currentVariant = activeVariant !== "base"
    ? variants.find((v) => v.platform === activeVariant && v.lang === lang)
    : null;
  const previewTitle = currentVariant ? currentVariant.title : ((lang === "ko" ? post?.titleKo : post?.titleEn) ?? "");
  const previewContent = currentVariant ? currentVariant.content : ((lang === "ko" ? post?.contentKo : post?.contentEn) ?? "");
  const previewHashtags = currentVariant ? currentVariant.hashtags : ((lang === "ko" ? post?.hashtagsKo : post?.hashtagsEn) ?? []);
  const variantsForLang = variants.filter((v) => v.lang === lang);

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
          alt={photo.caption ?? `Photo ${photo.orderIndex}`}
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
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[var(--bg-elevated)] border border-[var(--border)] text-sm px-5 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <div className="flex gap-1 bg-[var(--bg-elevated)] rounded-lg p-1">
              {(["preview", "edit"] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                  tab === t ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]",
                )}>
                  {t === "preview" ? "미리보기" : "편집"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex gap-1 bg-[var(--bg-elevated)] rounded-lg p-1">
                {(["ko", "en"] as Lang[]).map((l) => (
                  <button key={l} onClick={() => { setLang(l); setActiveVariant("base"); }} className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    lang === l ? "bg-[var(--bg-card)] text-[var(--text)]" : "text-[var(--text-muted)] hover:text-[var(--text)]",
                  )}>
                    {l === "ko" ? "한국어" : "English"}
                  </button>
                ))}
              </div>
              <Badge variant={post?.status === "generated" ? "default" : "secondary"}>
                {post?.status === "generated" ? "완료" : "초안"}
              </Badge>
            </div>
          </div>

          {/* Content */}
          <Card>
            <CardContent className="p-6 space-y-4">
              {tab === "preview" ? (
                <>
                  {/* Variant toggle */}
                  {variantsForLang.length > 0 && (
                    <div className="flex gap-1 bg-[var(--bg-elevated)] rounded-lg p-1 mb-2">
                      {(["base", "naver", "tistory", "medium"] as const).map((v) => {
                        if (v !== "base" && !variants.find((vr) => vr.platform === v && vr.lang === lang)) return null;
                        const label = v === "base" ? "기본" : v === "naver" ? "네이버" : v === "tistory" ? "티스토리" : "Medium";
                        return (
                          <button
                            key={v}
                            onClick={() => setActiveVariant(v)}
                            className={cn(
                              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                              activeVariant === v
                                ? "bg-[var(--accent)] text-white"
                                : "text-[var(--text-muted)] hover:text-[var(--text)]",
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}

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
                  <div className="space-y-1.5">
                    <Label>제목</Label>
                    {lang === "ko"
                      ? <Input value={titleKo} onChange={(e) => setTitleKo(e.target.value)} />
                      : <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />}
                  </div>
                  <div className="space-y-1.5">
                    <Label>본문</Label>
                    {lang === "ko"
                      ? <Textarea value={contentKo} onChange={(e) => setContentKo(e.target.value)} rows={6} className="font-mono text-sm leading-relaxed min-h-[200px] md:min-h-[400px]" />
                      : <Textarea value={contentEn} onChange={(e) => setContentEn(e.target.value)} rows={6} className="font-mono text-sm leading-relaxed min-h-[200px] md:min-h-[400px]" />}
                  </div>
                  {/* Partial Regeneration */}
                  <div className="rounded-lg border border-[var(--border)] p-3 space-y-2">
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
                                <p className="text-[10px] text-[var(--accent)] font-medium mb-1">재생성 결과:</p>
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
                        className="text-xs h-6 px-2"
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
                  <Button onClick={handleSave} disabled={saving} className="w-full">
                    {saving ? "저장 중..." : "수정 저장"}
                  </Button>
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

          {/* Generation Info */}
          {post?.generationMeta && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI 생성 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3">
                    <p className="text-[10px] text-[var(--text-muted)] mb-1">글 생성 모델</p>
                    <p className="text-sm font-semibold text-[var(--text)]">{post.generationMeta.mainModel}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3">
                    <p className="text-[10px] text-[var(--text-muted)] mb-1">사진 분석</p>
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {post.generationMeta.visionProvider === "gemini" ? "Gemini" : post.generationMeta.visionProvider === "openai" ? "OpenAI" : "없음"}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">{post.generationMeta.visionModel}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3">
                    <p className="text-[10px] text-[var(--text-muted)] mb-1">에이전트 리서치</p>
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {post.generationMeta.researchProvider === "gemini" ? "Gemini" : post.generationMeta.researchProvider === "openai" ? "OpenAI" : "없음"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-elevated)] p-3">
                    <p className="text-[10px] text-[var(--text-muted)] mb-1">문체 학습</p>
                    <p className="text-sm font-semibold text-[var(--text)]">과거 글 {post.generationMeta.styleContextPosts}개</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border)]">
                  <span>토큰: {(post.generationMeta.inputTokens + post.generationMeta.outputTokens).toLocaleString()} ({post.generationMeta.inputTokens.toLocaleString()} in / {post.generationMeta.outputTokens.toLocaleString()} out)</span>
                  <span>${post.generationMeta.cost.toFixed(4)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SEO Score */}
          {post?.status === "generated" && (
            <SeoScoreCard postId={postId} lang={lang} onError={showToast} />
          )}

          {/* Platform SEO Optimize */}
          {post?.status === "generated" && (
            <PlatformOptimizeCard
              postId={postId}
              lang={lang}
              variants={variants}
              onOptimized={(variant) => {
                setVariants((prev) => {
                  const idx = prev.findIndex((v) => v.platform === variant.platform && v.lang === variant.lang);
                  if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = variant;
                    return updated;
                  }
                  return [...prev, variant];
                });
              }}
              onToast={showToast}
            />
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

          {/* Face Mosaic */}
          {photos.length > 0 && (
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">얼굴 모자이크</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    사진에서 얼굴을 감지하여 자동 모자이크 처리합니다 ({photos.length}장)
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFaceMosaic}
                  disabled={faceMosaicApplying}
                >
                  {faceMosaicApplying ? "처리 중..." : "얼굴 모자이크"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Platform Copy */}
          <Card>
            <CardHeader><CardTitle className="text-lg">플랫폼별 복사</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-[var(--text-muted)] mb-3">사진 img 태그와 해시태그가 포함됩니다</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button variant="outline" onClick={() => handleCopy("naver")} className="w-full">
                  네이버 복사
                </Button>
                <Button variant="outline" onClick={() => handleCopy("tistory")} className="w-full">
                  티스토리 복사 (MD)
                </Button>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Button
                    variant="outline"
                    onClick={() => handlePublish("tistory")}
                    disabled={publishing}
                    className="w-full"
                  >
                    {publishing ? "발행 중..." : "티스토리에 발행"}
                  </Button>
                  {hasTistoryConnection ? (
                    <p className="text-[10px] text-green-500 text-center">연동됨</p>
                  ) : (
                    <p className="text-[10px] text-[var(--text-muted)] text-center">
                      <Link href="/dashboard/settings" className="text-[var(--accent)] hover:underline">설정에서 연동</Link>
                    </p>
                  )}
                </div>
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
                    <p className="text-[10px] text-green-500 text-center">연동됨</p>
                  ) : (
                    <p className="text-[10px] text-[var(--text-muted)] text-center">
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
                  <p className="text-[10px] text-[var(--text-muted)] text-center">환경변수 설정 필요</p>
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
            <SchedulePublishCard
              postId={postId}
              post={{ scheduledAt: post.scheduledAt, scheduledPlatform: post.scheduledPlatform, scheduledLang: post.scheduledLang }}
              lang={lang}
              onUpdate={(updated) => setPost((prev) => prev ? { ...prev, ...updated } : prev)}
              onToast={showToast}
            />
          )}

          {/* Publish History */}
          <PublishHistoryCard history={publishHistory} />

          {/* Competitor Analysis */}
          {post?.status === "generated" && (
            <CompetitorAnalysisCard postId={postId} lang={lang} onError={showToast} />
          )}

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
