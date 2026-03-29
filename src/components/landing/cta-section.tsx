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
        <div className="rounded-3xl bg-gradient-to-br from-[var(--accent)]/12 via-[var(--warm-glow)] to-[var(--warm)]/8 p-12 md:p-16 text-center space-y-5 relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[var(--warm)]/5 blur-3xl" />

          <h2 className="text-3xl font-bold tracking-tight text-[var(--text)] relative z-10">{heading}</h2>
          {description && (
            <p className="text-base leading-relaxed text-[var(--text-secondary)] max-w-md mx-auto relative z-10">
              {description}
            </p>
          )}
          <div className="pt-3 relative z-10">
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
