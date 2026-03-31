"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import type { DropResult } from "@hello-pangea/dnd";

const DragDropContext = dynamic(
  () => import("@hello-pangea/dnd").then((mod) => mod.DragDropContext),
  { ssr: false },
);
const Droppable = dynamic(
  () => import("@hello-pangea/dnd").then((mod) => mod.Droppable),
  { ssr: false },
);
const Draggable = dynamic(
  () => import("@hello-pangea/dnd").then((mod) => mod.Draggable),
  { ssr: false },
);

type SearchResult = {
  title: string;
  category: string;
  address: string;
  roadAddress: string;
};

type PlaceCategory = "restaurant" | "cafe" | "accommodation" | "attraction";

type StyleProfile = {
  id: number;
  name: string;
  isSystemPreset: boolean;
  analyzedTone: Record<string, string>;
};

type LocalPhoto = {
  id: number;
  filePath: string;
  caption: string | null;
  orderIndex: number;
  _file: File;
};

const CATEGORY_OPTIONS: { value: PlaceCategory; label: string }[] = [
  { value: "restaurant", label: "맛집" },
  { value: "cafe", label: "카페" },
  { value: "accommodation", label: "숙소" },
  { value: "attraction", label: "여행지" },
];

const selectClass =
  "w-full h-11 rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-colors";

const MAX_PHOTOS = 20;

export default function DashboardNewPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Place fields
  const [placeName, setPlaceName] = useState("");
  const [category, setCategory] = useState<PlaceCategory>("restaurant");
  const [address, setAddress] = useState("");
  const [rating, setRating] = useState("");
  const [memo, setMemo] = useState("");

  // Menu items (for restaurants/cafes)
  const [menuItems, setMenuItems] = useState<{ name: string; price: string }[]>([]);

  // Photos
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [dragging, setDragging] = useState(false);
  const [thumbnailIdx, setThumbnailIdx] = useState(0); // index of selected thumbnail photo

  // Style
  const [styles, setStyles] = useState<StyleProfile[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<number | null>(null);

  // Place search autocomplete
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Revisit
  const [isRevisit, setIsRevisit] = useState(false);
  const [existingPlaces, setExistingPlaces] = useState<{ id: number; name: string; category: string; photoCount: number; menuItemCount: number }[]>([]);
  const [selectedExistingPlaceId, setSelectedExistingPlaceId] = useState<number | null>(null);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [currentStep, setCurrentStep] = useState("");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [sseRecoveryPostId, setSseRecoveryPostId] = useState<number | null>(null);

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/style-profiles")
      .then((r) => r.json())
      .then((data) => {
        const all = [...(data.presets ?? []), ...(data.customs ?? [])];
        setStyles(all);
        if (all.length > 0) setSelectedStyleId(all[0].id);
      })
      .catch(() => {});

    fetch("/api/places/my")
      .then((r) => (r.ok ? r.json() : { places: [] }))
      .then((data) => setExistingPlaces(data.places ?? []))
      .catch(() => {});

    // Restore auto-saved form state
    try {
      const saved = localStorage.getItem("draft-new-post");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.placeName) setPlaceName(data.placeName);
        if (data.category) setCategory(data.category);
        if (data.address) setAddress(data.address);
        if (data.rating) setRating(data.rating);
        if (data.memo) setMemo(data.memo);
        if (data.menuItems) setMenuItems(data.menuItems);
        if (data.selectedStyleId) setSelectedStyleId(data.selectedStyleId);
      }
    } catch { /* ignore corrupt data */ }
  }, []);

  // Auto-save form state to localStorage (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("draft-new-post", JSON.stringify({
          placeName, category, address, rating, memo, menuItems, selectedStyleId,
        }));
      } catch { /* storage full or unavailable */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [placeName, category, address, rating, memo, menuItems, selectedStyleId]);

  // ── Place search ──
  const handlePlaceNameChange = (value: string) => {
    setPlaceName(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(value.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.items ?? []);
          setShowResults((data.items ?? []).length > 0);
        }
      } catch { /* ignore */ }
    }, 300);
  };

  const selectSearchResult = (item: SearchResult) => {
    setPlaceName(item.title);
    setAddress(item.roadAddress || item.address);
    // Map naver category to our categories
    const cat = item.category.toLowerCase();
    if (cat.includes("카페") || cat.includes("coffee") || cat.includes("디저트")) {
      setCategory("cafe");
    } else if (cat.includes("음식") || cat.includes("맛집") || cat.includes("한식") || cat.includes("중식") || cat.includes("일식") || cat.includes("양식")) {
      setCategory("restaurant");
    } else if (cat.includes("숙박") || cat.includes("호텔") || cat.includes("펜션") || cat.includes("모텔")) {
      setCategory("accommodation");
    } else if (cat.includes("관광") || cat.includes("여행") || cat.includes("명소")) {
      setCategory("attraction");
    }
    setShowResults(false);
    setSearchResults([]);
  };

  // ── Menu helpers ──
  const addMenuItem = () => setMenuItems((prev) => [...prev, { name: "", price: "" }]);
  const updateMenuItem = (i: number, field: "name" | "price", value: string) =>
    setMenuItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));
  const removeMenuItem = (i: number) => setMenuItems((prev) => prev.filter((_, idx) => idx !== i));

  // ── Photo helpers ──
  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArr = Array.from(files);
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];

      setPhotos((prev) => {
        const remaining = MAX_PHOTOS - prev.length;
        const toAdd = fileArr.filter((f) => allowed.includes(f.type)).slice(0, remaining);
        return [
          ...prev,
          ...toAdd.map((file, i) => ({
            id: -(prev.length + i + 1),
            filePath: URL.createObjectURL(file),
            caption: null,
            orderIndex: prev.length + i + 1,
            _file: file,
          })),
        ];
      });
    },
    [],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const updateCaption = (i: number, caption: string) =>
    setPhotos((prev) => prev.map((p, idx) => (idx === i ? { ...p, caption: caption || null } : p)));

  const removePhoto = (i: number) => {
    setPhotos((prev) => {
      const removed = prev[i];
      if (removed.filePath.startsWith("blob:")) URL.revokeObjectURL(removed.filePath);
      return prev.filter((_, idx) => idx !== i);
    });
    setThumbnailIdx((prev) => {
      if (i < prev) return prev - 1;
      if (i === prev) return 0;
      return prev;
    });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    setPhotos((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((p, i) => ({ ...p, orderIndex: i + 1 }));
    });
  };

  // ── Submit ──
  const handleGenerate = async () => {
    setError("");
    setSseRecoveryPostId(null);
    const errors: Record<string, string> = {};

    if (isRevisit && !selectedExistingPlaceId) { errors.place = "재방문할 장소를 선택해주세요."; }
    if (!isRevisit && !placeName.trim()) { errors.place = "장소 이름을 입력해주세요."; }
    if (photos.length === 0) { errors.photos = "사진을 최소 1장 업로드해주세요."; }
    if (!selectedStyleId) { errors.style = "문체 프로필을 선택해주세요."; }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) { setError("입력 정보를 확인해주세요."); return; }

    setGenerating(true);
    setCurrentStep("");
    setCompletedSteps([]);

    try {
      let placeId: number;

      if (isRevisit && selectedExistingPlaceId) {
        // Use existing place for revisit
        placeId = selectedExistingPlaceId;
        setUploadProgress("기존 장소 사용 중...");
      } else {
        // 1. Create new place
        setUploadProgress("장소 저장 중...");
        const placeRes = await fetch("/api/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: placeName.trim(),
            category,
            address: address.trim() || undefined,
            rating: rating ? parseFloat(rating) : undefined,
            memo: memo.trim() || undefined,
          }),
        });
        const placeData = await placeRes.json();
        if (!placeRes.ok) throw new Error(placeData.error ?? "장소 저장 실패");
        placeId = placeData.place.id;
      }

      // 2. Upload photos (thumbnail first at order 1)
      const orderedPhotos = [...photos];
      if (thumbnailIdx > 0 && thumbnailIdx < orderedPhotos.length) {
        const [thumb] = orderedPhotos.splice(thumbnailIdx, 1);
        orderedPhotos.unshift(thumb);
      }
      for (let i = 0; i < orderedPhotos.length; i++) {
        setUploadProgress(`사진 업로드 중... (${i + 1}/${orderedPhotos.length})`);
        const photo = orderedPhotos[i];
        const formData = new FormData();
        formData.append("file", photo._file);
        formData.append("placeId", placeId.toString());
        formData.append("orderIndex", (i + 1).toString());
        if (photo.caption) formData.append("caption", photo.caption);
        const photoRes = await fetch("/api/photos", { method: "POST", body: formData });
        if (!photoRes.ok) throw new Error(`사진 ${i + 1} 업로드 실패`);
      }

      // 3. Create menu items
      const validMenus = menuItems.filter((m) => m.name.trim());
      if (validMenus.length > 0) {
        setUploadProgress("메뉴 저장 중...");
        for (const item of validMenus) {
          const menuRes = await fetch("/api/menu-items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ placeId, name: item.name.trim(), priceKrw: parseInt(item.price, 10) || 0 }),
          });
          if (!menuRes.ok) throw new Error(`메뉴 "${item.name}" 저장 실패`);
        }
      }

      // 4. Generate post via AI (SSE streaming)
      setUploadProgress("AI 글 생성 준비 중...");
      const genRes = await fetch("/api/posts/generate-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, styleProfileId: selectedStyleId, memo: memo.trim(), isRevisit }),
      });

      if (!genRes.ok || !genRes.body) {
        const text = await genRes.text().catch(() => "");
        throw new Error(text || "AI 생성 요청 실패");
      }

      const reader = genRes.body.getReader();
      const decoder = new TextDecoder();
      let resultPostId: number | null = null;
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7);
          } else if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              if (currentEvent === "progress") {
                setUploadProgress(data.message ?? "처리 중...");
                if (data.step) {
                  setCurrentStep((prev) => {
                    if (prev && prev !== data.step) {
                      setCompletedSteps((cs) => cs.includes(prev) ? cs : [...cs, prev]);
                    }
                    return data.step;
                  });
                }
                if (data.postId) { resultPostId = data.postId; setSseRecoveryPostId(data.postId); }
              } else if (currentEvent === "complete") {
                resultPostId = data.post?.id ?? resultPostId;
              } else if (currentEvent === "error") {
                throw new Error(data.message ?? "글 생성 실패");
              }
            } catch (e) {
              if (e instanceof Error && e.message !== "글 생성 실패") {
                // JSON parse error — ignore partial data
              } else {
                throw e;
              }
            }
          }
        }
      }

      if (!resultPostId) throw new Error("글 생성 결과를 받지 못했습니다.");

      // Clear auto-saved draft on success
      try { localStorage.removeItem("draft-new-post"); } catch { /* ignore */ }

      // 5. Navigate to edit page
      router.push(`/dashboard/${resultPostId}/edit`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "오류가 발생했습니다.";
      setError(errMsg);
    } finally {
      setGenerating(false);
      setUploadProgress("");
    }
  };

  const showMenuSection = category === "restaurant" || category === "cafe";

  return (
    <section className="w-full py-12">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">새 글 작성</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              장소 정보와 사진을 입력하면 AI가 한영 블로그 글을 자동 생성합니다.
            </p>
          </div>

          {error && (
            <div role="alert" aria-live="polite" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <p>{error}</p>
              {sseRecoveryPostId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={() => router.push(`/dashboard/${sseRecoveryPostId}/edit`)}
                >
                  생성된 글 확인하기
                </Button>
              )}
            </div>
          )}

          {/* ── Revisit toggle ── */}
          {existingPlaces.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">재방문 리뷰</p>
                    <p className="text-xs text-[var(--text-muted)]">이전에 작성한 장소를 선택하여 재방문 글을 작성합니다</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsRevisit(!isRevisit);
                      if (!isRevisit) setSelectedExistingPlaceId(null);
                    }}
                    className={cn(
                      "relative w-12 h-7 rounded-full transition-colors",
                      isRevisit ? "bg-[var(--accent)]" : "bg-[var(--bg-elevated)] border border-[var(--border)]",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform shadow-sm",
                        isRevisit ? "translate-x-5.5" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </div>
                {isRevisit && (
                  <div className="mt-3 space-y-2">
                    <Label>기존 장소 선택</Label>
                    <select
                      value={selectedExistingPlaceId ?? ""}
                      onChange={(e) => setSelectedExistingPlaceId(e.target.value ? parseInt(e.target.value, 10) : null)}
                      className={selectClass}
                    >
                      <option value="">장소를 선택하세요</option>
                      {existingPlaces.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({CATEGORY_OPTIONS.find((c) => c.value === p.category)?.label ?? p.category}) — 사진 {p.photoCount}장
                        </option>
                      ))}
                    </select>
                    {selectedExistingPlaceId && (
                      <p className="text-xs text-[var(--text-muted)]">
                        기존 장소 정보를 사용합니다. 새 사진을 추가하고 메모를 작성해주세요.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── 1. 장소 정보 ── */}
          {!isRevisit && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">장소 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5 relative">
                <Label htmlFor="placeName">장소명 *</Label>
                <div className="relative">
                  <Input
                    id="placeName"
                    value={placeName}
                    onChange={(e) => { handlePlaceNameChange(e.target.value); setFieldErrors((prev) => { const n = { ...prev }; delete n.place; return n; }); }}
                    onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                    placeholder="예: 을지로 골목식당 (자동검색)"
                    autoComplete="off"
                    className={fieldErrors.place ? "border-[var(--danger)]" : ""}
                  />
                  {placeName && (
                    <button
                      type="button"
                      onClick={() => { setPlaceName(""); setSearchResults([]); setShowResults(false); setAddress(""); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text)] text-xs flex items-center justify-center"
                      aria-label="장소명 지우기"
                    >
                      ×
                    </button>
                  )}
                </div>
                {fieldErrors.place && <p className="text-xs text-[var(--danger)]">{fieldErrors.place}</p>}
                {showResults && searchResults.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((item, i) => (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSearchResult(item)}
                        className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-card)] transition-colors border-b border-[var(--border)] last:border-0"
                      >
                        <div className="text-sm font-medium text-[var(--text)]">{item.title}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">
                          {item.category && <span className="mr-2">{item.category}</span>}
                          {item.roadAddress || item.address}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category">카테고리 *</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PlaceCategory)}
                  className={selectClass}
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address">주소</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="예: 서울시 중구 을지로 123"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rating">별점 (1~5)</Label>
                <Input
                  id="rating"
                  type="number"
                  min="1"
                  max="5"
                  step="0.5"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  placeholder="4.5"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="memo">한줄 메모</Label>
                <Textarea
                  id="memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="방문 느낌, 추천 포인트 등을 자유롭게 적어주세요..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
          )}

          {/* ── 2. 메뉴/가격 ── */}
          {!isRevisit && showMenuSection && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">메뉴 / 가격</CardTitle>
                  <Button variant="outline" size="sm" onClick={addMenuItem}>
                    + 메뉴 추가
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {menuItems.length === 0 && (
                  <p className="text-sm text-[var(--text-muted)] text-center py-4">
                    메뉴를 추가하면 글에 자동 포함됩니다
                  </p>
                )}
                {menuItems.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      value={item.name}
                      onChange={(e) => updateMenuItem(i, "name", e.target.value)}
                      placeholder="메뉴명"
                      className="flex-1"
                    />
                    <Input
                      value={item.price}
                      onChange={(e) => updateMenuItem(i, "price", e.target.value)}
                      placeholder="가격(원)"
                      type="number"
                      className="w-28"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeMenuItem(i)} className="text-red-400 hover:text-red-300 shrink-0">
                      삭제
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── 3. 사진 업로드 ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">사진 *</CardTitle>
                <Badge variant="secondary">{photos.length}/{MAX_PHOTOS}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {photos.length < MAX_PHOTOS && (
                <div
                  ref={dropZoneRef}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                    dragging
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] hover:border-[var(--border-hover)]",
                  )}
                >
                  <p className="text-sm text-[var(--text-muted)]">
                    {dragging ? "여기에 놓으세요!" : "클릭 또는 드래그앤드롭으로 사진 추가"}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">JPEG, PNG, WebP, HEIC / 최대 10MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              )}

              {photos.length > 0 && (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="photos" direction="horizontal">
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
                      >
                        {photos.map((photo, i) => (
                          <Draggable key={`photo-${i}`} draggableId={`photo-${i}`} index={i}>
                            {(dragProvided, snapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={cn("relative group", snapshot.isDragging && "opacity-80 shadow-lg z-10")}
                              >
                                <div
                                  {...dragProvided.dragHandleProps}
                                  className="absolute top-1 left-1 z-10 flex items-center gap-1"
                                >
                                  <span className="bg-black/60 text-white text-[10px] rounded px-1.5 py-0.5 cursor-grab active:cursor-grabbing flex items-center gap-0.5">
                                    ⠿ {i + 1}
                                  </span>
                                </div>
                                <img
                                  src={photo.filePath}
                                  alt={photo.caption ?? `사진 ${i + 1}`}
                                  className="w-full h-32 object-cover rounded-lg"
                                />
                                <button
                                  onClick={() => setThumbnailIdx(i)}
                                  className={cn(
                                    "absolute bottom-10 left-1 w-6 h-6 rounded-full text-xs flex items-center justify-center transition-all",
                                    thumbnailIdx === i
                                      ? "bg-yellow-400 text-black"
                                      : "bg-black/40 text-white/60 opacity-100 md:opacity-0 md:group-hover:opacity-100",
                                  )}
                                  title="대표 사진 지정"
                                >
                                  ★
                                </button>
                                <button
                                  onClick={() => removePhoto(i)}
                                  className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full text-white text-xs flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                >
                                  X
                                </button>
                                <Input
                                  value={photo.caption ?? ""}
                                  onChange={(e) => updateCaption(i, e.target.value)}
                                  placeholder="사진 설명..."
                                  className="mt-1 text-xs h-9"
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </CardContent>
          </Card>

          {/* ── 4. 문체 프로필 선택 ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">문체 프로필</CardTitle>
            </CardHeader>
            <CardContent>
              {styles.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-4">문체 프로필 불러오는 중...</p>
              ) : (
                <select
                  value={selectedStyleId ?? ""}
                  onChange={(e) => setSelectedStyleId(Number(e.target.value))}
                  className={selectClass}
                >
                  <optgroup label="시스템 프리셋">
                    {styles.filter((s) => s.isSystemPreset).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.analyzedTone.tone}/{s.analyzedTone.formality})
                      </option>
                    ))}
                  </optgroup>
                  {styles.some((s) => !s.isSystemPreset) && (
                    <optgroup label="내 커스텀 프로필">
                      {styles.filter((s) => !s.isSystemPreset).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.analyzedTone.tone}/{s.analyzedTone.formality})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
            </CardContent>
          </Card>

          {/* ── 5. 생성 버튼 + 파이프라인 진행 표시 ── */}
          <Button
            onClick={handleGenerate}
            disabled={generating || !placeName.trim() || photos.length === 0 || !selectedStyleId}
            className="w-full min-h-[48px] text-base"
          >
            {generating ? uploadProgress || "처리 중..." : "글 생성하기"}
          </Button>

          {generating && currentStep && (
            <Card className="border-[var(--accent)]/20 bg-[var(--bg-elevated)]">
              <CardContent className="pt-4 pb-3">
                <div className="space-y-2">
                  {[
                    { key: "preparing", label: "데이터 준비" },
                    { key: "loading", label: "장소 정보 로딩" },
                    { key: "enriching", label: "장소 보강 & 사진 분석" },
                    { key: "generating", label: "AI 글 생성" },
                    { key: "validating", label: "품질 검증" },
                    { key: "polishing", label: "글 다듬기" },
                    { key: "saving", label: "저장" },
                  ].map(({ key, label }) => {
                    const isDone = completedSteps.includes(key);
                    const isCurrent = currentStep === key;
                    return (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        {isDone ? (
                          <span className="w-5 h-5 rounded-full bg-[var(--success)]/20 text-[var(--success)] flex items-center justify-center text-xs font-bold">✓</span>
                        ) : isCurrent ? (
                          <span className="w-5 h-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                        ) : (
                          <span className="w-5 h-5 rounded-full border border-[var(--border)]" />
                        )}
                        <span className={isDone ? "text-[var(--text-muted)]" : isCurrent ? "text-[var(--text)] font-medium" : "text-[var(--text-muted)]"}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
