import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface HeroSectionProps {
  headline: string;
  subheadline: string;
  ctaText?: string;
  ctaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
}

export function HeroSection({
  headline,
  subheadline,
  ctaText = "무료로 시작하기",
  ctaHref = "/signup",
  secondaryCtaText,
  secondaryCtaHref,
}: HeroSectionProps) {
  return (
    <section className="w-full min-h-[85vh] flex items-center relative overflow-hidden">
      {/* Background: warm subtle texture */}
      <div className="absolute inset-0 hero-grid-bg" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[var(--bg)] to-transparent" />

      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center py-20 md:py-28">
          {/* Left: Copy — left-aligned, strong hierarchy */}
          <div className="space-y-8 fade-in-up">
            <Badge variant="secondary" className="text-xs px-3 py-1.5 rounded-full border-[var(--accent)]/20 bg-[var(--accent-soft)]">
              <span className="text-[var(--accent)] font-medium">사진만 올리면 끝</span>
            </Badge>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
              {headline}
            </h1>

            <p className="text-lg leading-[1.8] text-[var(--text-secondary)] max-w-lg">
              {subheadline}
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-2">
              <Button asChild size="lg" className="btn-gradient text-base px-8">
                <Link href={ctaHref} className="no-underline">
                  {ctaText}
                </Link>
              </Button>
              {secondaryCtaText && secondaryCtaHref && (
                <Button asChild variant="outline" size="lg" className="text-base">
                  <Link href={secondaryCtaHref} className="no-underline">
                    {secondaryCtaText}
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Right: App preview mockup */}
          <div className="hidden lg:block fade-in-up fade-in-up-delay-2">
            <div className="relative">
              {/* Browser frame */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl overflow-hidden">
                {/* Title bar */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
                  <div className="w-3 h-3 rounded-full bg-[var(--danger)]/40" />
                  <div className="w-3 h-3 rounded-full bg-[var(--warning)]/40" />
                  <div className="w-3 h-3 rounded-full bg-[var(--success)]/40" />
                  <div className="flex-1 mx-4 h-6 rounded-md bg-[var(--bg-elevated)] flex items-center px-3">
                    <span className="text-[10px] text-[var(--text-muted)]">blog-auto-writer.app</span>
                  </div>
                </div>

                {/* Mock content */}
                <div className="p-6 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                      <span className="text-xs text-[var(--success)] font-medium">생성 완료</span>
                    </div>
                    <div className="h-5 w-3/4 rounded bg-[var(--text)]/8" />
                    <div className="h-3 w-full rounded bg-[var(--text)]/4" />
                    <div className="h-3 w-5/6 rounded bg-[var(--text)]/4" />
                    <div className="h-3 w-4/5 rounded bg-[var(--text)]/4" />
                  </div>

                  {/* Mock photo row */}
                  <div className="flex gap-2 pt-1">
                    <div className="w-20 h-14 rounded-lg bg-[var(--warm)]/12" />
                    <div className="w-20 h-14 rounded-lg bg-[var(--accent)]/12" />
                    <div className="w-20 h-14 rounded-lg bg-[var(--warm)]/8" />
                  </div>

                  {/* Mock hashtags */}
                  <div className="flex gap-1.5 flex-wrap">
                    {["#맛집", "#서울맛집", "#솔직후기", "#블로그"].map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
