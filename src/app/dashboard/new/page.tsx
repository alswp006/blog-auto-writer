"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PhotoUploader, type LocalPhoto } from "@/components/post/photo-uploader";

type SearchResult = {
  title: string;
  category: string;
  address: string;
  roadAddress: string;
};

type PlaceCategory = "restaurant" | "cafe" | "accommodation" | "attraction";

type ExistingPlace = {
  id: number;
  name: string;
  category: string;
  address: string | null;
  photoCount: number;
  menuItemCount: number;
};

type StyleProfile = {
  id: number;
  name: string;
  isSystemPreset: boolean;
  analyzedTone: Record<string, string>;
};

const CATEGORY_OPTIONS: { value: PlaceCategory; label: string }[] = [
  { value: "restaurant", label: "맛집" },
  { value: "cafe", label: "카페" },
  { value: "accommodation", label: "숙소" },
  { value: "attraction", label: "여행지" },
];

const selectClass =
  "w-full h-10 rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-colors";

export default function DashboardNewPage() {
  const router = useRouter();

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
  const [existingPlaces, setExistingPlaces] = useState<ExistingPlace[]>([]);
  const [selectedExistingPlaceId, setSelectedExistingPlaceId] = useState<number | null>(null);
  const [placeSearchQuery, setPlaceSearchQuery] = useState("");
  const [showPlaceDropdown, setShowPlaceDropdown] = useState(false);
  const placeSearchRef = useRef<HTMLDivElement>(null);

  // Menu autocomplete
  const [menuSuggestions, setMenuSuggestions] = useState<{ name: string; priceKrw: number }[]>([]);
  const [activeMenuIdx, setActiveMenuIdx] = useState<number | null>(null);
  const [showMenuSuggestions, setShowMenuSuggestions] = useState(false);
  const menuSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Menu auto-suggest from blogs
  const menuLoading = false; // kept for template compatibility

  // Generation
  const [generating, setGenerating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");

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
  }, []);

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
    let detectedCategory: PlaceCategory = category;
    if (cat.includes("카페") || cat.includes("coffee") || cat.includes("디저트")) {
      detectedCategory = "cafe";
    } else if (cat.includes("음식") || cat.includes("맛집") || cat.includes("한식") || cat.includes("중식") || cat.includes("일식") || cat.includes("양식")) {
      detectedCategory = "restaurant";
    } else if (cat.includes("숙박") || cat.includes("호텔") || cat.includes("펜션") || cat.includes("모텔")) {
      detectedCategory = "accommodation";
    } else if (cat.includes("관광") || cat.includes("여행") || cat.includes("명소")) {
      detectedCategory = "attraction";
    }
    setCategory(detectedCategory);
    setShowResults(false);
    setSearchResults([]);

  };

  // ── Existing place search (local filter) ──
  const filteredPlaces = placeSearchQuery.trim().length === 0
    ? existingPlaces
    : existingPlaces.filter((p) => {
        const q = placeSearchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.address ?? "").toLowerCase().includes(q);
      });

  const selectExistingPlace = (place: ExistingPlace) => {
    setSelectedExistingPlaceId(place.id);
    setPlaceSearchQuery(`${place.name}${place.address ? ` - ${place.address}` : ""}`);
    setShowPlaceDropdown(false);
  };

  // ── Menu helpers ──
  const addMenuItem = () => setMenuItems((prev) => [...prev, { name: "", price: "" }]);
  const updateMenuItem = (i: number, field: "name" | "price", value: string) =>
    setMenuItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));
  const removeMenuItem = (i: number) => setMenuItems((prev) => prev.filter((_, idx) => idx !== i));

  const handleMenuNameChange = (i: number, value: string) => {
    updateMenuItem(i, "name", value);
    setActiveMenuIdx(i);
    if (menuSearchTimerRef.current) clearTimeout(menuSearchTimerRef.current);
    if (value.trim().length === 0) {
      setMenuSuggestions([]);
      setShowMenuSuggestions(false);
      return;
    }
    menuSearchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/menu-items/suggestions?q=${encodeURIComponent(value.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setMenuSuggestions(data.suggestions ?? []);
          setShowMenuSuggestions((data.suggestions ?? []).length > 0);
        }
      } catch { /* ignore */ }
    }, 200);
  };

  const selectMenuSuggestion = (suggestion: { name: string; priceKrw: number }) => {
    if (activeMenuIdx !== null) {
      setMenuItems((prev) =>
        prev.map((item, idx) =>
          idx === activeMenuIdx ? { name: suggestion.name, price: suggestion.priceKrw > 0 ? suggestion.priceKrw.toString() : "" } : item,
        ),
      );
    }
    setShowMenuSuggestions(false);
    setMenuSuggestions([]);
  };

  // ── Submit ──
  const handleGenerate = async () => {
    setError("");

    if (isRevisit && !selectedExistingPlaceId) { setError("재방문할 장소를 선택해주세요."); return; }
    if (!isRevisit && !placeName.trim()) { setError("장소 이름을 입력해주세요."); return; }
    if (photos.length === 0) { setError("사진을 최소 1장 업로드해주세요."); return; }
    if (!selectedStyleId) { setError("문체 프로필을 선택해주세요."); return; }

    setGenerating(true);

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
        if (!photoRes.ok) {
          const errData = await photoRes.json().catch(() => ({ error: "사진 업로드 실패" }));
          throw new Error(errData.error ?? `사진 ${i + 1} 업로드 실패`);
        }
      }

      // 3. Create menu items
      const validMenus = menuItems.filter((m) => m.name.trim());
      if (validMenus.length > 0) {
        setUploadProgress("메뉴 저장 중...");
        for (const item of validMenus) {
          await fetch("/api/menu-items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ placeId, name: item.name.trim(), priceKrw: parseInt(item.price, 10) || 0 }),
          });
        }
      }

      // 4. Generate post via AI
      setUploadProgress("AI 글 생성 중... (30초~1분 소요)");
      const genRes = await fetch("/api/posts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, styleProfileId: selectedStyleId, memo: memo.trim(), isRevisit }),
      });
      let genData;
      try {
        genData = await genRes.json();
      } catch {
        throw new Error("AI 생성 요청 시간이 초과되었습니다. 다시 시도해주세요.");
      }
      if (!genRes.ok) throw new Error(genData.error ?? "글 생성 실패");

      // 5. Navigate to edit page
      router.push(`/dashboard/${genData.post.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
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
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
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
                      if (!isRevisit) {
                        setSelectedExistingPlaceId(null);
                        setPlaceSearchQuery("");
                      }
                    }}
                    className={cn(
                      "relative w-11 h-6 rounded-full transition-colors",
                      isRevisit ? "bg-[var(--accent)]" : "bg-[var(--bg-elevated)] border border-[var(--border)]",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm",
                        isRevisit ? "translate-x-5" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </div>
                {isRevisit && (
                  <div className="mt-3 space-y-2">
                    <Label>기존 장소 검색</Label>
                    <div className="relative" ref={placeSearchRef}>
                      <Input
                        value={placeSearchQuery}
                        onChange={(e) => {
                          setPlaceSearchQuery(e.target.value);
                          setShowPlaceDropdown(true);
                          if (selectedExistingPlaceId) setSelectedExistingPlaceId(null);
                        }}
                        onFocus={() => setShowPlaceDropdown(true)}
                        onBlur={() => setTimeout(() => setShowPlaceDropdown(false), 200)}
                        placeholder="장소명 또는 주소로 검색..."
                        autoComplete="off"
                      />
                      {showPlaceDropdown && filteredPlaces.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredPlaces.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectExistingPlace(p)}
                              className={cn(
                                "w-full text-left px-3 py-2.5 hover:bg-[var(--bg-card)] transition-colors border-b border-[var(--border)] last:border-0",
                                selectedExistingPlaceId === p.id && "bg-[var(--accent-soft)]",
                              )}
                            >
                              <div className="text-sm font-medium text-[var(--text)]">
                                {p.name}
                                <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                                  {CATEGORY_OPTIONS.find((c) => c.value === p.category)?.label ?? p.category}
                                </span>
                              </div>
                              {p.address && (
                                <div className="text-xs text-[var(--text-muted)] mt-0.5">{p.address}</div>
                              )}
                              <div className="text-xs text-[var(--text-muted)] mt-0.5">
                                사진 {p.photoCount}장 · 메뉴 {p.menuItemCount}개
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {showPlaceDropdown && filteredPlaces.length === 0 && placeSearchQuery.trim().length > 0 && (
                        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-lg px-3 py-3">
                          <p className="text-sm text-[var(--text-muted)] text-center">일치하는 장소가 없습니다</p>
                        </div>
                      )}
                    </div>
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
                <Input
                  id="placeName"
                  value={placeName}
                  onChange={(e) => handlePlaceNameChange(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                  onBlur={() => setTimeout(() => setShowResults(false), 200)}
                  placeholder="예: 을지로 골목식당 (자동검색)"
                  autoComplete="off"
                />
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
                {!menuLoading && menuItems.length === 0 && (
                  <p className="text-sm text-[var(--text-muted)] text-center py-4">
                    먹은 메뉴를 추가해주세요
                  </p>
                )}
                {menuItems.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center relative">
                    <div className="flex-1 relative">
                      <Input
                        value={item.name}
                        onChange={(e) => handleMenuNameChange(i, e.target.value)}
                        onFocus={() => {
                          setActiveMenuIdx(i);
                          if (item.name.trim().length > 0 && menuSuggestions.length > 0) setShowMenuSuggestions(true);
                        }}
                        onBlur={() => setTimeout(() => setShowMenuSuggestions(false), 200)}
                        placeholder="메뉴명 (이전 입력 자동완성)"
                        autoComplete="off"
                      />
                      {showMenuSuggestions && activeMenuIdx === i && menuSuggestions.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {menuSuggestions.map((s, si) => (
                            <button
                              key={si}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectMenuSuggestion(s)}
                              className="w-full text-left px-3 py-2 hover:bg-[var(--bg-card)] transition-colors border-b border-[var(--border)] last:border-0"
                            >
                              <span className="text-sm text-[var(--text)]">{s.name}</span>
                              {s.priceKrw > 0 && (
                                <span className="text-xs text-[var(--text-muted)] ml-2">{s.priceKrw.toLocaleString()}원</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
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
          <PhotoUploader
            photos={photos}
            thumbnailIdx={thumbnailIdx}
            dragging={dragging}
            onPhotosChange={setPhotos}
            onThumbnailChange={setThumbnailIdx}
            onDraggingChange={setDragging}
          />

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

          {/* ── 5. 생성 버튼 ── */}
          <Button
            onClick={handleGenerate}
            disabled={generating || (!isRevisit && !placeName.trim()) || (isRevisit && !selectedExistingPlaceId) || photos.length === 0 || !selectedStyleId}
            className="w-full min-h-[48px] text-base"
          >
            {generating ? uploadProgress || "처리 중..." : "글 생성하기"}
          </Button>
        </div>
      </div>
    </section>
  );
}
