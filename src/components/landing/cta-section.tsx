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
  ctaText = "Get Started Free",
  ctaHref = "/signup",
}: CtaSectionProps) {
  return (
    <section className="w-full py-20">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="rounded-2xl bg-gradient-to-r from-[var(--accent)]/10 to-purple-500/10 p-10 md:p-8 text-center space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)]">{heading}</h2>
          {description && (
            <p className="text-base leading-relaxed text-[var(--text-secondary)] max-w-md mx-auto">
              {description}
            </p>
          )}
          <div className="pt-2">
            <Button asChild size="lg">
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
