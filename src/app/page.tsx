import { generateMetadata as seo } from "@/lib/seo";
import { HeroSection } from "@/components/landing/hero-section";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { CtaSection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";

export const metadata = seo({
  title: "Home",
  description: "가족이 함께 쓰는 블로그 수익화 도구 — 사진과 메모만 올리면 5분 안에 한영 포스팅 완성.",
  path: "/",
});

export default function HomePage() {
  return (
    <div className="space-y-0">
      <HeroSection
        headline="Blog Auto Writer"
        subheadline="가족이 함께 쓰는 블로그 수익화 도구 — 사진과 메모만 올리면 5분 안에 한영 포스팅 완성."
        ctaText="Get Started"
        ctaHref="/signup"
        secondaryCtaText="Login"
        secondaryCtaHref="/login"
      />

      <FeatureGrid
        heading="Everything You Need"
        subheading="Powerful features to help you build, launch, and scale."
        features={[
          {
            icon: "⚡",
            title: "Lightning Fast",
            description:
              "Optimized for speed with modern architecture and edge-ready deployment.",
          },
          {
            icon: "🔒",
            title: "Secure by Default",
            description:
              "Built-in authentication, session management, and security best practices.",
          },
          {
            icon: "📦",
            title: "Ready to Ship",
            description:
              "Pre-built components, payments, and analytics — everything you need to launch.",
          },
        ]}
      />

      <CtaSection
        heading="Ready to Get Started?"
        description="Join today and start building in minutes. No credit card required."
        ctaText="Create Your Account"
        ctaHref="/signup"
      />

      <Footer />
    </div>
  );
}
