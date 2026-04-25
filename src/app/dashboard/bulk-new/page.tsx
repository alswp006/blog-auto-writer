"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { groupPhotosByTime } from "@/lib/client/exif-grouping";

// ── Types ──────────────────────────────────────────────────────────────────

type PlaceCategory = "restaurant" | "cafe" | "accommodation" | "attraction";

type SlotPhoto = {
  uid: string;
  filePath: string;
  caption: string | null;
  _file: File;
};

type SlotStatus = "idle" | "creating-place" | "uploading" | "generating" | "done" | "error";

type PlaceSlot = {
  id: string;
  placeName: string;
  category: PlaceCategory;
  memo: string;
  photos: SlotPhoto[];
  thumbnailIdx: number;
  status: SlotStatus;
  progress: string;
  postId: number | null;
  error: string | null;
};

type StyleProfile = {
  id: number;
  name: string;
  isSystemPreset: boolean;
};

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: PlaceCategory; label: string }[] = [
  { value: "restaurant", label: "맛집" },
  { value: "cafe", label: "카페" },
  { value: "accommodation", label: "숙소" },
  { value: "attraction", label: "여행지" },
];

const STATUS_CONFIG: Record<SlotStatus, { label: string; color: string }> = {
  idle:             { label: "대기",         color: "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)]" },
  "creating-place": { label: "장소 저장 중", color: "bg-blue-500/20 text-blue-400" },
  uploading:        { label: "사진 업로드 중", color: "bg-blue-500/20 text-blue-400" },
  generating:       { label: "글 생성 중",   color: "bg-yellow-500/20 text-yellow-400" },
  done:             { label: "완료 ✓",       color: "bg-green-500/20 text-green-400" },
  error:            { label: "오류",         color: "bg-red-500/20 text-red-400" },
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ALLOWED_EXTS  = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
const MAX_PHOTOS_PER_SLOT = 20;

// ── Helpers ────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function createEmptySlot(): PlaceSlot {
  return {
    id: uid(),
    placeName: "",
    category: "cafe",
    memo: "",
    photos: [],
    thumbnailIdx: 0,
    status: "idle",
    progress: "",
    postId: null,
    error: null,
  };
}

function getFilenameCaption(file: File): string | null {
  const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
  const strangePatterns = [
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    /^\d+$/,
    /^(IMG|DSC|DCIM|Photo|image|photo|pic|screenshot|capture)[-_]?\d+$/i,
    /^\d{8}[-_T]\d{6}$/,
    /^[0-9a-f]{16,}$/i,
  ];
  if (strangePatterns.some((p) => p.test(nameWithoutExt))) return null;
  return nameWithoutExt;
}

function filterImageFiles(files: File[]): File[] {
  return files.filter((f) => {
    if (ALLOWED_TYPES.includes(f.type)) return true;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    return ALLOWED_EXTS.includes(ext);
  });
}

function filesToSlotPhotos(files: File[]): SlotPhoto[] {
  return files.map((file) => ({
    uid: uid(),
    filePath: URL.createObjectURL(file),
    caption: getFilenameCaption(file),
    _file: file,
  }));
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function BulkNewPage() {
  const [slots, setSlots] = useState<PlaceSlot[]>([createEmptySlot()]);
  const [styleProfiles, setStyleProfiles] = useState<StyleProfile[]>([]);
  const [styleProfileId, setStyleProfileId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [globalDragging, setGlobalDragging] = useState(false);
  const [groupingNotice, setGroupingNotice] = useState<{ text: string; ok: boolean } | null>(null);

  // Shared hidden file input — tracks which slot is receiving photos
  const slotFileInputRef = useRef<HTMLInputElement>(null);
  const activeSlotIdRef = useRef<string | null>(null);

  // Global batch upload file input
  const globalFileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch style profiles ──
  useEffect(() => {
    fetch("/api/style-profiles")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.profiles) return;
        setStyleProfiles(data.profiles);
        // Auto-select first profile
        if (data.profiles.length > 0 && !styleProfileId) {
          setStyleProfileId(data.profiles[0].id);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Slot helpers ──
  const updateSlot = useCallback((id: string, updates: Partial<PlaceSlot>) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, []);

  const addSlot = () => setSlots((prev) => [...prev, createEmptySlot()]);

  const removeSlot = (id: string) => {
    setSlots((prev) => {
      const slot = prev.find((s) => s.id === id);
      if (slot) slot.photos.forEach((p) => URL.revokeObjectURL(p.filePath));
      return prev.filter((s) => s.id !== id);
    });
  };

  const addPhotosToSlot = useCallback((slotId: string, files: File[]) => {
    const images = filterImageFiles(files);
    if (images.length === 0) return;
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== slotId) return s;
        const remaining = MAX_PHOTOS_PER_SLOT - s.photos.length;
        const toAdd = filesToSlotPhotos(images.slice(0, remaining));
        return { ...s, photos: [...s.photos, ...toAdd] };
      })
    );
  }, []);

  const removePhotoFromSlot = (slotId: string, photoUid: string) => {
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== slotId) return s;
        const photo = s.photos.find((p) => p.uid === photoUid);
        if (photo) URL.revokeObjectURL(photo.filePath);
        const photos = s.photos.filter((p) => p.uid !== photoUid);
        return { ...s, photos, thumbnailIdx: Math.min(s.thumbnailIdx, Math.max(0, photos.length - 1)) };
      })
    );
  };

  const updateCaption = (slotId: string, photoUid: string, caption: string) => {
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== slotId) return s;
        return {
          ...s,
          photos: s.photos.map((p) => (p.uid === photoUid ? { ...p, caption: caption || null } : p)),
        };
      })
    );
  };

  // ── Per-slot file picker ──
  const triggerSlotUpload = (slotId: string) => {
    activeSlotIdRef.current = slotId;
    slotFileInputRef.current?.click();
  };

  const handleSlotFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slotId = activeSlotIdRef.current;
    if (e.target.files && slotId) {
      addPhotosToSlot(slotId, Array.from(e.target.files));
    }
    if (slotFileInputRef.current) slotFileInputRef.current.value = "";
    activeSlotIdRef.current = null;
  };

  // ── Global batch drop/upload + EXIF grouping ──
  const handleBatchFiles = useCallback(
    async (files: File[]) => {
      const images = filterImageFiles(files);
      if (images.length === 0) return;

      setGroupingNotice(null);

      const groups = await groupPhotosByTime(images);
      const hasExif = groups.some((g) => g.hasExif);

      const newSlots: PlaceSlot[] = groups.map((group) => ({
        ...createEmptySlot(),
        photos: filesToSlotPhotos(group.photos),
      }));

      setSlots((prev) => {
        // If existing slots have any content, append; otherwise replace
        const hasContent = prev.some((s) => s.photos.length > 0 || s.placeName.trim());
        return hasContent ? [...prev, ...newSlots] : newSlots;
      });

      if (groups.length > 1) {
        setGroupingNotice(
          hasExif
            ? { text: `촬영 시간 기준으로 ${groups.length}개 장소로 자동 분류했어요`, ok: true }
            : { text: `EXIF 정보가 없어 장소를 구분할 수 없었어요. 슬롯을 직접 나눠주세요`, ok: false }
        );
      } else {
        if (!hasExif && images.length > 1) {
          setGroupingNotice({ text: "EXIF 정보가 없어 한 그룹으로 묶었어요. 장소가 여러 개라면 슬롯을 추가해주세요", ok: false });
        }
      }
    },
    []
  );

  const handleGlobalDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setGlobalDragging(false);
      if (e.dataTransfer.files.length > 0) handleBatchFiles(Array.from(e.dataTransfer.files));
    },
    [handleBatchFiles]
  );

  const handleGlobalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleBatchFiles(Array.from(e.target.files));
    if (globalFileInputRef.current) globalFileInputRef.current.value = "";
  };

  // ── Generation ──
  const generateOneSlot = useCallback(
    async (slot: PlaceSlot, styleId: number) => {
      const { id: slotId } = slot;

      try {
        // 1. Create place
        updateSlot(slotId, { status: "creating-place", progress: "장소 저장 중...", error: null });
        const placeRes = await fetch("/api/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: slot.placeName.trim(),
            category: slot.category,
            memo: slot.memo.trim() || undefined,
          }),
        });
        const placeData = await placeRes.json();
        if (!placeRes.ok) throw new Error(placeData.error ?? "장소 저장 실패");
        const placeId: number = placeData.place.id;

        // 2. Upload photos (thumbnail first)
        updateSlot(slotId, { status: "uploading" });
        const ordered = [...slot.photos];
        if (slot.thumbnailIdx > 0 && slot.thumbnailIdx < ordered.length) {
          const [thumb] = ordered.splice(slot.thumbnailIdx, 1);
          ordered.unshift(thumb);
        }
        for (let i = 0; i < ordered.length; i++) {
          updateSlot(slotId, { progress: `사진 업로드 중... (${i + 1}/${ordered.length})` });
          const photo = ordered[i];
          const formData = new FormData();
          formData.append("file", photo._file);
          formData.append("placeId", placeId.toString());
          formData.append("orderIndex", (i + 1).toString());
          if (photo.caption) formData.append("caption", photo.caption);
          const photoRes = await fetch("/api/photos", { method: "POST", body: formData });
          if (!photoRes.ok) throw new Error(`사진 ${i + 1} 업로드 실패`);
        }

        // 3. AI generation (SSE)
        updateSlot(slotId, { status: "generating", progress: "AI 글 생성 중..." });
        const genRes = await fetch("/api/posts/generate-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placeId, styleProfileId: styleId, memo: slot.memo.trim(), isRevisit: false }),
        });

        if (!genRes.ok || !genRes.body) {
          const text = await genRes.text().catch(() => "");
          throw new Error(text || "글 생성 요청 실패");
        }

        const reader = genRes.body.getReader();
        const decoder = new TextDecoder();
        let resultPostId: number | null = null;
        let buffer = "";
        let currentEvent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7);
            } else if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (currentEvent === "progress") {
                  updateSlot(slotId, { progress: data.message ?? "처리 중..." });
                  if (data.postId) resultPostId = data.postId;
                } else if (currentEvent === "complete") {
                  resultPostId = data.post?.id ?? resultPostId;
                } else if (currentEvent === "error") {
                  throw new Error(data.message ?? "글 생성 실패");
                }
              } catch (e) {
                if (e instanceof Error && !["글 생성 실패"].includes(e.message)) {
                  // JSON parse error — ignore
                } else {
                  throw e;
                }
              }
            }
          }
        }

        if (!resultPostId) throw new Error("결과를 받지 못했습니다");
        updateSlot(slotId, { status: "done", postId: resultPostId, progress: "완료!" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "오류가 발생했습니다";
        updateSlot(slotId, { status: "error", error: msg, progress: "" });
      }
    },
    [updateSlot]
  );

  const generateAll = async () => {
    if (!styleProfileId) return;
    setGenerating(true);
    // Snapshot current slots to avoid React state batching issues
    const currentSlots = slots.filter(
      (s) => s.status !== "done" && s.placeName.trim() && s.photos.length > 0
    );
    for (const slot of currentSlots) {
      await generateOneSlot(slot, styleProfileId);
    }
    setGenerating(false);
  };

  // ── Derived state ──
  const validSlots = slots.filter((s) => s.placeName.trim() && s.photos.length > 0);
  const canGenerate = !generating && !!styleProfileId && validSlots.length > 0;
  const allDone = slots.length > 0 && slots.every((s) => s.status === "done");
  const doneCount = slots.filter((s) => s.status === "done").length;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <section className="w-full py-12">
      {/* Shared hidden file inputs */}
      <input
        ref={slotFileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleSlotFileSelect}
        className="hidden"
      />
      <input
        ref={globalFileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleGlobalFileSelect}
        className="hidden"
      />

      <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8 space-y-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">여러 글 한번에 생성</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              장소별로 사진과 정보를 입력하면 AI가 모두 순차적으로 생성해요
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/new" className="no-underline">글 하나 쓰기</Link>
          </Button>
        </div>

        {/* ── Style Profile ── */}
        <Card>
          <CardContent className="pt-5">
            <Label className="text-sm font-medium mb-2 block">문체 프로필 (전체 공통)</Label>
            {styleProfiles.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                문체 프로필이 없어요.{" "}
                <Link href="/style-profiles" className="text-[var(--accent)] underline">
                  먼저 만들어주세요
                </Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {styleProfiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setStyleProfileId(p.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm border transition-colors",
                      styleProfileId === p.id
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "border-[var(--border)] hover:border-[var(--border-hover)] text-[var(--text-secondary)]"
                    )}
                  >
                    {p.name}
                    {p.isSystemPreset && (
                      <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">기본</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Global Batch Drop Zone ── */}
        {!generating && (
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setGlobalDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setGlobalDragging(false); }}
            onDrop={handleGlobalDrop}
            onClick={() => globalFileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
              globalDragging
                ? "border-[var(--accent)] bg-[var(--accent-soft)] scale-[1.01]"
                : "border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]"
            )}
          >
            <p className="text-2xl mb-2">📸</p>
            <p className="text-sm font-medium text-[var(--text)]">
              {globalDragging ? "여기에 놓으세요!" : "사진 전체를 한번에 올리면 장소별로 자동 분류해요"}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              촬영 시간 기준으로 90분 이상 차이나면 다른 장소로 분류 · EXIF 없으면 한 그룹으로 묶어요
            </p>
          </div>
        )}

        {/* ── Grouping Notice ── */}
        {groupingNotice && (
          <div
            className={cn(
              "rounded-lg px-4 py-3 text-sm flex items-start gap-2",
              groupingNotice.ok
                ? "bg-green-500/10 border border-green-500/30 text-green-400"
                : "bg-yellow-500/10 border border-yellow-500/30 text-yellow-400"
            )}
          >
            <span>{groupingNotice.ok ? "✓" : "⚠"}</span>
            <span>{groupingNotice.text}</span>
            <button
              onClick={() => setGroupingNotice(null)}
              className="ml-auto text-current opacity-50 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Slot List ── */}
        <div className="space-y-4">
          {slots.map((slot, slotIdx) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              slotNumber={slotIdx + 1}
              generating={generating}
              onPlaceNameChange={(v) => updateSlot(slot.id, { placeName: v })}
              onCategoryChange={(v) => updateSlot(slot.id, { category: v })}
              onMemoChange={(v) => updateSlot(slot.id, { memo: v })}
              onThumbnailChange={(idx) => updateSlot(slot.id, { thumbnailIdx: idx })}
              onAddPhotos={() => triggerSlotUpload(slot.id)}
              onRemovePhoto={(photoUid) => removePhotoFromSlot(slot.id, photoUid)}
              onCaptionChange={(photoUid, caption) => updateCaption(slot.id, photoUid, caption)}
              onRemoveSlot={() => removeSlot(slot.id)}
            />
          ))}
        </div>

        {/* ── Add Slot + Generate ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          {!generating && (
            <Button variant="outline" onClick={addSlot} className="sm:w-auto">
              + 장소 추가
            </Button>
          )}

          <div className="flex-1" />

          <div className="flex flex-col items-end gap-2">
            {generating && (
              <p className="text-sm text-[var(--text-muted)]">
                {doneCount}/{validSlots.length}개 완료 · 순차 생성 중...
              </p>
            )}
            {allDone && (
              <p className="text-sm text-green-400">
                모든 글이 생성됐어요 🎉
              </p>
            )}
            <Button
              onClick={generateAll}
              disabled={!canGenerate}
              className="min-w-[160px]"
            >
              {generating
                ? `생성 중... (${doneCount}/${validSlots.length})`
                : `전체 생성하기 (${validSlots.length}개)`}
            </Button>
            {!styleProfileId && (
              <p className="text-xs text-[var(--text-muted)]">문체 프로필을 선택해주세요</p>
            )}
            {styleProfileId && validSlots.length === 0 && (
              <p className="text-xs text-[var(--text-muted)]">장소명과 사진을 입력한 슬롯이 없어요</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── SlotCard ───────────────────────────────────────────────────────────────

function SlotCard({
  slot,
  slotNumber,
  generating,
  onPlaceNameChange,
  onCategoryChange,
  onMemoChange,
  onThumbnailChange,
  onAddPhotos,
  onRemovePhoto,
  onCaptionChange,
  onRemoveSlot,
}: {
  slot: PlaceSlot;
  slotNumber: number;
  generating: boolean;
  onPlaceNameChange: (v: string) => void;
  onCategoryChange: (v: PlaceCategory) => void;
  onMemoChange: (v: string) => void;
  onThumbnailChange: (idx: number) => void;
  onAddPhotos: () => void;
  onRemovePhoto: (uid: string) => void;
  onCaptionChange: (uid: string, caption: string) => void;
  onRemoveSlot: () => void;
}) {
  const status = STATUS_CONFIG[slot.status];
  const isActive = slot.status !== "idle" && slot.status !== "done" && slot.status !== "error";
  const isDone   = slot.status === "done";
  const isError  = slot.status === "error";
  const isLocked = generating || isDone; // disable editing while generating or after done

  return (
    <Card
      className={cn(
        "transition-all",
        isDone  && "border-green-500/30 bg-green-500/5",
        isError && "border-red-500/30",
        isActive && "border-[var(--accent)]/40"
      )}
    >
      {/* ── Card Header ── */}
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Slot number */}
          <span className="text-xs font-mono text-[var(--text-muted)] w-5 shrink-0">
            {slotNumber}
          </span>

          {/* Place name */}
          <div className="flex-1 min-w-[140px]">
            <Input
              value={slot.placeName}
              onChange={(e) => onPlaceNameChange(e.target.value)}
              placeholder="장소 이름 *"
              disabled={isLocked}
              className="h-9 text-sm"
            />
          </div>

          {/* Category */}
          <select
            value={slot.category}
            onChange={(e) => onCategoryChange(e.target.value as PlaceCategory)}
            disabled={isLocked}
            className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-2.5 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 transition-colors"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Status badge */}
          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", status.color)}>
            {isActive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />}
            {status.label}
          </span>

          {/* Remove */}
          {!generating && !isDone && (
            <button
              onClick={onRemoveSlot}
              className="text-[var(--text-muted)] hover:text-red-400 transition-colors text-sm ml-auto shrink-0"
              aria-label="슬롯 삭제"
            >
              ✕
            </button>
          )}
        </div>

        {/* Progress / Error message */}
        {isActive && slot.progress && (
          <p className="text-xs text-[var(--accent)] mt-1 ml-8">{slot.progress}</p>
        )}
        {isError && slot.error && (
          <p className="text-xs text-red-400 mt-1 ml-8">{slot.error}</p>
        )}
        {isDone && slot.postId && (
          <div className="mt-1 ml-8">
            <Button variant="outline" size="sm" asChild className="text-xs h-7">
              <Link href={`/dashboard/${slot.postId}/edit`} className="no-underline" target="_blank">
                결과 보러가기 →
              </Link>
            </Button>
          </div>
        )}
      </CardHeader>

      {/* ── Card Content ── */}
      <CardContent className="space-y-4 pt-0">
        {/* Photos grid */}
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {slot.photos.map((photo, photoIdx) => (
              <div key={photo.uid} className="relative group">
                <img
                  src={photo.filePath}
                  alt={photo.caption ?? `사진 ${photoIdx + 1}`}
                  className="w-full h-24 object-cover rounded-lg"
                />
                {/* Thumbnail star */}
                <button
                  onClick={() => onThumbnailChange(photoIdx)}
                  disabled={isLocked}
                  className={cn(
                    "absolute top-1 left-1 w-5 h-5 rounded-full text-xs flex items-center justify-center transition-all",
                    slot.thumbnailIdx === photoIdx
                      ? "bg-yellow-400 text-black"
                      : "bg-black/40 text-white/60 opacity-0 group-hover:opacity-100"
                  )}
                  title="대표 사진"
                >
                  ★
                </button>
                {/* Remove */}
                {!isLocked && (
                  <button
                    onClick={() => onRemovePhoto(photo.uid)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                )}
                {/* Caption */}
                <input
                  type="text"
                  value={photo.caption ?? ""}
                  onChange={(e) => onCaptionChange(photo.uid, e.target.value)}
                  placeholder="사진 설명..."
                  disabled={isLocked}
                  className="mt-1 w-full text-xs px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
                />
              </div>
            ))}

            {/* Add photos button */}
            {!isLocked && slot.photos.length < MAX_PHOTOS_PER_SLOT && (
              <button
                onClick={onAddPhotos}
                className="h-24 rounded-lg border-2 border-dashed border-[var(--border)] hover:border-[var(--border-hover)] flex flex-col items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-xs gap-1"
              >
                <span className="text-xl">+</span>
                <span>사진 추가</span>
              </button>
            )}
          </div>

          {slot.photos.length === 0 && (
            <button
              onClick={onAddPhotos}
              disabled={isLocked}
              className={cn(
                "w-full mt-1 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                isLocked
                  ? "border-[var(--border)] opacity-40 cursor-not-allowed"
                  : "border-[var(--border)] hover:border-[var(--border-hover)] cursor-pointer"
              )}
            >
              <p className="text-sm text-[var(--text-muted)]">사진을 추가해주세요 *</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">JPEG · PNG · WebP · HEIC</p>
            </button>
          )}
        </div>

        {/* Memo */}
        <div>
          <Textarea
            value={slot.memo}
            onChange={(e) => onMemoChange(e.target.value)}
            placeholder="한줄 메모 (선택) — 비워두면 AI가 사진 보고 판단해요"
            disabled={isLocked}
            rows={2}
            className="text-sm resize-none"
          />
        </div>
      </CardContent>
    </Card>
  );
}
