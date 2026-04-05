"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  naverHtml: string;
  onClose: () => void;
  showToast: (msg: string) => void;
};

export function NaverCopyModal({ naverHtml, onClose, showToast }: Props) {
  const [copied, setCopied] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);
  const [imageStats, setImageStats] = useState({ loaded: 0, failed: 0, total: 0 });

  const contentRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const imgs = node.querySelectorAll("img");
    const total = imgs.length;
    if (total === 0) { setImagesReady(true); setImageStats({ loaded: 0, failed: 0, total: 0 }); return; }
    let loaded = 0;
    let failed = 0;
    const check = () => {
      setImageStats({ loaded, failed, total });
      if (loaded + failed >= total) setImagesReady(true);
    };
    imgs.forEach((img) => {
      if (img.complete && img.naturalWidth > 0) { loaded++; check(); return; }
      if (img.complete) { failed++; check(); return; }
      img.addEventListener("load", () => { loaded++; check(); });
      img.addEventListener("error", () => {
        failed++;
        img.style.opacity = "0.3";
        img.style.border = "2px dashed #e55";
        img.alt = `(이미지 로드 실패) ${img.alt}`;
        check();
      });
    });
  }, []);

  const handleRichCopy = async () => {
    const contentEl = document.getElementById("naver-copy-content");
    if (!contentEl) return;

    // Strategy 1: Selection + execCommand
    const range = document.createRange();
    range.selectNodeContents(contentEl);
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(range); }
    const success = document.execCommand("copy");
    sel?.removeAllRanges();

    if (success) {
      setCopied(true);
      showToast("복사 완료! 네이버 에디터에 붙여넣기 하세요");
      return;
    }

    // Strategy 2: Clipboard API with text/html
    try {
      const html = contentEl.innerHTML;
      const htmlBlob = new Blob([html], { type: "text/html" });
      const textBlob = new Blob([contentEl.innerText], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob }),
      ]);
      setCopied(true);
      showToast("복사 완료! 네이버 에디터에 붙여넣기 하세요");
      return;
    } catch { /* continue to fallback */ }

    // Strategy 3: Plain text fallback
    try {
      await navigator.clipboard.writeText(contentEl.innerText);
      setCopied(true);
      showToast("텍스트만 복사됨 (이미지는 직접 추가해주세요)");
    } catch {
      showToast("복사 실패 — 내용을 길게 눌러 직접 선택해주세요");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex flex-col">
      {/* Header bar */}
      <div className={cn(
        "flex-none px-4 py-3 flex items-center justify-between",
        copied ? "bg-blue-600" : "bg-[#03C75A]"
      )}>
        <div className="flex-1 min-w-0 mr-3">
          {copied ? (
            <p className="text-white text-sm font-semibold">복사 완료! 네이버에 붙여넣기 하세요</p>
          ) : !imagesReady && imageStats.total > 0 ? (
            <p className="text-white/90 text-xs">
              이미지 로딩 중... ({imageStats.loaded + imageStats.failed}/{imageStats.total})
            </p>
          ) : imageStats.failed > 0 ? (
            <p className="text-yellow-200 text-xs">
              {imageStats.failed}장 로드 실패 — 나머지 {imageStats.loaded}장은 정상
            </p>
          ) : (
            <p className="text-white text-sm font-semibold">복사하기 버튼을 눌러주세요</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-none">
          <Button
            size="sm"
            onClick={handleRichCopy}
            disabled={!imagesReady}
            className={cn(
              "text-xs font-semibold px-4",
              !imagesReady
                ? "bg-white/50 text-[#03C75A]/50 cursor-not-allowed"
                : copied
                  ? "bg-white hover:bg-gray-100 text-blue-600"
                  : "bg-white hover:bg-gray-100 text-[#03C75A]"
            )}
          >
            {!imagesReady ? "로딩 중..." : copied ? "다시 복사" : "복사하기"}
          </Button>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl leading-none p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            &times;
          </button>
        </div>
      </div>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div
          id="naver-copy-content"
          ref={contentRef}
          className="p-4 md:p-6 max-w-[720px] mx-auto text-[#333]"
          style={{ fontFamily: "-apple-system, 'Noto Sans KR', sans-serif" }}
          dangerouslySetInnerHTML={{ __html: naverHtml }}
        />
      </div>
    </div>
  );
}
