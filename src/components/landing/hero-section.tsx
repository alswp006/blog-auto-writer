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
    <section className="w-full min-h-[80vh] flex items-center relative overflow-hidden">
      {/* Background: warm gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--warm-glow)] via-transparent to-[var(--accent)]/5" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 rounded-full bg-[var(--accent)]/5 blur-3xl" />
      <div className="absolute bottom-1/4 -left-32 w-80 h-80 rounded-full bg-[var(--warm)]/5 blur-3xl" />

      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center py-16 md:py-24">
          {/* Left: Copy */}
          <div className="space-y-6 fade-in-up">
            <Badge variant="secondary" className="text-xs px-3 py-1 rounded-full border-[var(--warm)]/20 bg-[var(--warm-soft)]">
              <span className="text-[var(--warm)]">사진만 올리면 끝</span>
            </Badge>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.15]">
              <span className="gradient-text-warm">{headline}</span>
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

          {/* Right: App preview mockup (CSS only) */}
          <div className="hidden lg:block fade-in-up fade-in-up-delay-2">
            <div className="relative">
              {/* Mock browser frame */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl overflow-hidden">
                {/* Title bar */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
                  <div className="w-3 h-3 rounded-full bg-red-400/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
                  <div className="w-3 h-3 rounded-full bg-green-400/60" />
                  <div className="flex-1 mx-4 h-6 rounded-md bg-[var(--bg-elevated)] flex items-center px-3">
                    <span className="text-[10px] text-[var(--text-muted)]">blog-auto-writer.app</span>
                  </div>
                </div>

                {/* Mock content */}
                <div className="p-6 space-y-4">
                  {/* Mock generation result */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                      <span className="text-xs text-[var(--success)]">생성 완료</span>
                    </div>
                    <div className="h-5 w-3/4 rounded bg-[var(--text)]/10" />
                    <div className="h-3 w-full rounded bg-[var(--text)]/5" />
                    <div className="h-3 w-5/6 rounded bg-[var(--text)]/5" />
                    <div className="h-3 w-4/5 rounded bg-[var(--text)]/5" />
                  </div>

                  {/* Mock photo row */}
                  <div className="flex gap-2">
                    <div className="w-20 h-14 rounded-lg bg-gradient-to-br from-[var(--warm)]/20 to-[var(--accent)]/20" />
                    <div className="w-20 h-14 rounded-lg bg-gradient-to-br from-[var(--accent)]/20 to-[var(--warm)]/10" />
                    <div className="w-20 h-14 rounded-lg bg-gradient-to-br from-[var(--warm)]/10 to-[var(--accent)]/15" />
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

              {/* Floating accent glow */}
              <div className="absolute -bottom-4 -right-4 w-32 h-32 rounded-full bg-[var(--accent)]/10 blur-2xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
