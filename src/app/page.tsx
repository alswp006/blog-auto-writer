import { generateMetadata as seo } from "@/lib/seo";
import { HeroSection } from "@/components/landing/hero-section";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { HowItWorks } from "@/components/landing/how-it-works";
import { CtaSection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";
import { Zap, Globe, PenTool, Search, BarChart3, Shield } from "lucide-react";

export const metadata = seo({
  title: "블로그 자동 작성기",
  description: "가족이 함께 쓰는 블로그 수익화 도구 — 사진과 메모만 올리면 5분 안에 한영 포스팅 완성.",
  path: "/",
});

export default function HomePage() {
  return (
    <div className="space-y-0">
      <HeroSection
        headline="블로그 자동 작성기"
        subheadline="사진과 메모만 올리면 5분 안에 한영 포스팅이 완성됩니다. 가족이 함께 쓰는 블로그 수익화 도구."
        ctaText="시작하기"
        ctaHref="/signup"
        secondaryCtaText="로그인"
        secondaryCtaHref="/login"
      />

      <FeatureGrid
        heading="주요 기능"
        subheading="블로그 작성에 필요한 모든 것을 제공합니다."
        features={[
          {
            icon: <Zap className="w-5 h-5 text-[var(--accent)]" />,
            title: "5분 안에 완성",
            description:
              "사진과 장소 정보만 입력하면 AI가 한국어/영어 블로그 글을 자동으로 작성합니다.",
          },
          {
            icon: <Globe className="w-5 h-5 text-[var(--accent)]" />,
            title: "한영 동시 생성",
            description:
              "한국어와 영어 블로그 글을 한 번에 생성합니다. 외국인 관점의 자연스러운 영어 글이 특징입니다.",
          },
          {
            icon: <PenTool className="w-5 h-5 text-[var(--accent)]" />,
            title: "나만의 문체 학습",
            description:
              "본인이 쓴 글 샘플을 분석하여 나만의 문체를 학습합니다. AI가 내 스타일 그대로 글을 작성합니다.",
          },
          {
            icon: <Search className="w-5 h-5 text-[var(--accent)]" />,
            title: "자동 장소 리서치",
            description:
              "네이버, 구글에서 장소 정보와 다른 블로거 후기를 자동 수집하여 글에 반영합니다.",
          },
          {
            icon: <BarChart3 className="w-5 h-5 text-[var(--accent)]" />,
            title: "SEO 최적화",
            description:
              "네이버 블로그, 티스토리, 미디엄 등 각 플랫폼에 맞는 SEO 최적화 글을 생성합니다.",
          },
          {
            icon: <Shield className="w-5 h-5 text-[var(--accent)]" />,
            title: "품질 자동 검증",
            description:
              "생성된 글의 길이, 자연스러움, 사진 배치를 자동 검증하고, 기준에 미달하면 재생성합니다.",
          },
        ]}
      />

      <HowItWorks />

      <CtaSection
        heading="지금 바로 시작해보세요"
        description="사진과 메모만 올리면 블로그 글이 완성됩니다. 지금 바로 시작해보세요."
        ctaText="회원가입하기"
        ctaHref="/signup"
      />

      <Footer />
    </div>
  );
}
