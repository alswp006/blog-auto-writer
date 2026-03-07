import Link from "next/link";
import { Button } from "@/components/ui/button";

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
  ctaText = "Get Started",
  ctaHref = "/signup",
  secondaryCtaText,
  secondaryCtaHref,
}: HeroSectionProps) {
  return (
    <section className="w-full min-h-[70vh] flex items-center bg-gradient-to-b from-[var(--accent)]/5 via-transparent to-transparent">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 w-full flex flex-col items-center text-center space-y-6 py-16 md:py-24">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--text)] max-w-3xl leading-tight">
          {headline}
        </h1>
        <p className="text-lg leading-relaxed text-[var(--text-secondary)] max-w-xl">
          {subheadline}
        </p>
        <div className="flex gap-3 pt-2">
          <Button asChild size="lg">
            <Link href={ctaHref} className="no-underline">
              {ctaText}
            </Link>
          </Button>
          {secondaryCtaText && secondaryCtaHref && (
            <Button asChild variant="outline" size="lg">
              <Link href={secondaryCtaHref} className="no-underline">
                {secondaryCtaText}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
