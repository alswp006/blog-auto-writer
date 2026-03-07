"use client";

import { useEffect, useRef } from "react";

type AdFormat = "auto" | "rectangle" | "horizontal";

interface AdUnitProps {
  slot: string;
  format?: AdFormat;
}

const ADSENSE_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdUnit({ slot, format = "auto" }: AdUnitProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!ADSENSE_ID || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded — silently ignore
    }
  }, []);

  if (!ADSENSE_ID) return null;

  const style: React.CSSProperties =
    format === "rectangle"
      ? { display: "inline-block", width: 300, height: 250 }
      : format === "horizontal"
        ? { display: "inline-block", width: 728, height: 90 }
        : { display: "block" };

  return (
    <ins
      ref={adRef}
      className="adsbygoogle"
      style={style}
      data-ad-client={ADSENSE_ID}
      data-ad-slot={slot}
      {...(format === "auto" ? { "data-ad-format": "auto", "data-full-width-responsive": "true" } : {})}
    />
  );
}
