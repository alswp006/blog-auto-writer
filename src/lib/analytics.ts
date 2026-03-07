const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

type EventProperties = Record<string, string | number | boolean>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, properties?: EventProperties): void {
  if (!GA_ID || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", event, properties);
}

export function trackPageView(url: string): void {
  if (!GA_ID || typeof window === "undefined" || !window.gtag) return;
  window.gtag("config", GA_ID, { page_path: url });
}

export function isAnalyticsConfigured(): boolean {
  return !!GA_ID;
}
