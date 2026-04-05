"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Photo, Place, Platform, Lang } from "./types";
import { PLATFORM_LABELS } from "./types";
import { buildNaverHtml, formatForPlatform } from "./format-utils";

type Props = {
  postId: string;
  photos: Photo[];
  place: Place | null;
  lang: Lang;
  titleKo: string;
  titleEn: string;
  contentKo: string;
  contentEn: string;
  hashtagsKo: string;
  hashtagsEn: string;
  photoByIndex: Map<number, Photo>;
  showToast: (msg: string) => void;
  onOpenNaverModal: (html: string) => void;
};

export function PlatformCopyCard({
  postId, photos, place, lang,
  titleKo, titleEn, contentKo, contentEn,
  hashtagsKo, hashtagsEn, photoByIndex,
  showToast, onOpenNaverModal,
}: Props) {
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);
  const getTitle = () => lang === "ko" ? titleKo : titleEn;
  const getContent = () => lang === "ko" ? contentKo : contentEn;
  const getHashtags = () => (lang === "ko" ? hashtagsKo : hashtagsEn).split(/\s+/).filter(Boolean);
  const getTagStr = () => getHashtags().map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");

  const getIsMobile = () => {
    if (typeof window === "undefined") return false;
    return "ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 768;
  };

  const openNaverCopy = () => {
    const title = getTitle();
    const content = getContent();
    const tagStr = getTagStr();
    const naverHtml = buildNaverHtml(title, content, tagStr, photos, place, photoByIndex);

    const isMobile = getIsMobile();
    if (isMobile) {
      onOpenNaverModal(naverHtml);
      return;
    }

    // Desktop: try popup, fallback to modal
    const imgCount = photos.length;
    const popupHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>네이버 블로그 복사</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Noto Sans KR', sans-serif; padding: 24px; max-width: 720px; margin: 0 auto; background: #fff; color: #333; }
  img { max-width: 100%; height: auto; display: block; margin: 12px auto; border-radius: 4px; }
  .guide-bar { position: sticky; top: 0; background: #03C75A; color: #fff; padding: 12px 20px; margin: -24px -24px 24px -24px; text-align: center; font-size: 14px; font-weight: 600; z-index: 10; }
  .guide-bar kbd { background: rgba(255,255,255,0.25); padding: 2px 8px; border-radius: 4px; font-family: inherit; }
  .guide-bar .loading { font-size: 13px; opacity: 0.9; }
  .content-area { min-height: 200px; }
</style></head><body>
<div class="guide-bar">
  <span class="loading">이미지 로딩 중... (0/${imgCount})</span>
</div>
<div class="content-area">${naverHtml}</div>
<script>
  var bar = document.querySelector('.guide-bar');
  var imgs = document.querySelectorAll('.content-area img');
  var total = imgs.length, loaded = 0, failed = 0;
  function check() {
    if (total === 0 || loaded + failed >= total) {
      bar.innerHTML = '<kbd>Ctrl+A</kbd> 전체선택 \\u2192 <kbd>Ctrl+C</kbd> 복사 \\u2192 네이버 에디터에 <kbd>Ctrl+V</kbd>';
      if (failed > 0) bar.innerHTML = '\\u26A0 이미지 ' + failed + '장 로드 실패 | ' + bar.innerHTML;
      var range = document.createRange();
      range.selectNodeContents(document.querySelector('.content-area'));
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      bar.querySelector('.loading').textContent = '이미지 로딩 중... (' + (loaded + failed) + '/' + total + ')';
    }
  }
  imgs.forEach(function(img) {
    if (img.complete && img.naturalWidth > 0) { loaded++; check(); return; }
    if (img.complete) { failed++; img.style.opacity='0.3'; img.style.border='2px dashed #e55'; check(); return; }
    img.addEventListener('load', function() { loaded++; check(); });
    img.addEventListener('error', function() { failed++; img.style.opacity='0.3'; img.style.border='2px dashed #e55'; check(); });
  });
  if (total === 0) check();
  document.addEventListener('copy', function() {
    bar.textContent = '\\u2705 복사 완료! 네이버 에디터에 Ctrl+V로 붙여넣기 하세요';
    bar.style.background = '#2563eb';
  });
</script></body></html>`;

    const popup = window.open("", "naver_copy", "width=780,height=800,scrollbars=yes,resizable=yes");
    if (popup) {
      popup.document.write(popupHtml);
      popup.document.close();
      popup.focus();
    } else {
      onOpenNaverModal(naverHtml);
    }
  };

  const handleCopy = async (platform: Platform) => {
    // Naver with photos: open copy preview
    if (platform === "naver" && photos.length > 0) {
      openNaverCopy();
      try {
        await fetch(`/api/posts/${postId}/record-copy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, lang }),
        });
      } catch { /* non-critical */ }
      return;
    }

    const title = getTitle();
    const content = getContent();
    const tagStr = getTagStr();
    const text = formatForPlatform(platform, title, content, tagStr, photos, place, photoByIndex);

    // Tistory: copy as rich text (HTML) for paste in HTML mode
    if (platform === "tistory" && typeof ClipboardItem !== "undefined") {
      try {
        const blob = new Blob([text], { type: "text/html" });
        const plainBlob = new Blob([text], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({ "text/html": blob, "text/plain": plainBlob }),
        ]);
      } catch {
        await navigator.clipboard.writeText(text);
      }
    } else {
      await navigator.clipboard.writeText(text);
    }

    setCopiedPlatform(platform);
    setTimeout(() => setCopiedPlatform(null), 3000);
    showToast(`${PLATFORM_LABELS[platform]} 포맷 복사됨!`);

    // Record copy in publish history
    if (platform === "naver" || platform === "tistory") {
      try {
        await fetch(`/api/posts/${postId}/record-copy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, lang }),
        });
      } catch { /* non-critical */ }
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">플랫폼별 복사</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-[var(--text-muted)]">글 + 이미지 + 해시태그가 포함됩니다.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Button
              variant={copiedPlatform === "naver" ? "default" : "outline"}
              onClick={() => handleCopy("naver")}
              className="w-full min-h-[44px] transition-all"
            >
              {copiedPlatform === "naver" ? "✓ 복사됨!" : photos.length > 0 ? "네이버 복사 (이미지 포함)" : "네이버 복사"}
            </Button>
            <p className="text-xs text-[var(--text-muted)] text-center">
              {photos.length > 0 ? "미리보기에서 복사" : "에디터에 붙여넣기"}
            </p>
          </div>
          <div className="space-y-1">
            <Button
              variant={copiedPlatform === "tistory" ? "default" : "outline"}
              onClick={() => handleCopy("tistory")}
              className="w-full min-h-[44px] transition-all"
            >
              {copiedPlatform === "tistory" ? "✓ 복사됨!" : "티스토리 복사 (HTML)"}
            </Button>
            <p className="text-xs text-[var(--text-muted)] text-center">HTML 모드에서 Ctrl+V</p>
          </div>
          <Button
            variant={copiedPlatform === "medium" ? "default" : "outline"}
            onClick={() => handleCopy("medium")}
            className="w-full min-h-[44px] transition-all"
          >
            {copiedPlatform === "medium" ? "✓ 복사됨!" : "Medium 복사 (MD)"}
          </Button>
        </div>
        {photos.length > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)]">
            <p className="text-xs text-[var(--text-secondary)] font-medium mb-1">플랫폼별 이미지 안내</p>
            <p className="text-xs text-[var(--text-muted)]">
              네이버: 미리보기가 열리면 &quot;복사하기&quot; 버튼을 눌러 이미지 포함 복사 → 네이버 에디터에 붙여넣기
            </p>
            <div className="text-xs text-[var(--text-muted)] mt-1 space-y-0.5">
              <p className="font-medium text-[var(--text-secondary)]">티스토리:</p>
              <p>1. &quot;티스토리 복사&quot; 클릭</p>
              <p>2. 티스토리 에디터 우측 상단 &quot;HTML&quot; 탭 클릭</p>
              <p>3. Ctrl+V (또는 길게 눌러 붙여넣기)</p>
              <p>4. &quot;기본모드&quot; 탭으로 돌아가면 이미지+글이 보입니다</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
