import Link from "next/link";
import { Button } from "@/components/ui/button";

interface CtaSectionProps {
  heading: string;
  description?: string;
  ctaText?: string;
  ctaHref?: string;
}

export function CtaSection({
  heading,
  description,
  ctaText = "무료로 시작하기",
  ctaHref = "/signup",
}: CtaSectionProps) {
  return (
    <section className="w-full py-24">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 md:p-12 lg:p-16 space-y-5 relative overflow-hidden">
          {/* Subtle accent stripe at top */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--accent)]" />

          <h2 className="text-3xl font-bold tracking-tight text-[var(--text)]">{heading}</h2>
          {description && (
            <p className="text-base leading-relaxed text-[var(--text-secondary)] max-w-md">
              {description}
            </p>
          )}
          <div className="pt-3">
            <Button asChild size="lg" className="btn-gradient text-base px-8">
              <Link href={ctaHref} className="no-underline">
                {ctaText}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
