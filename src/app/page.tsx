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
        headline="사진 올리면, 글이 완성돼요"
        subheadline="맛집 사진 찍고 메모 한 줄이면 충분해요. AI가 한국어·영어 블로그 글을 5분 안에 써드립니다."
        ctaText="무료로 시작하기"
        ctaHref="/signup"
        secondaryCtaText="이미 계정이 있으신가요?"
        secondaryCtaHref="/login"
      />

      <FeatureGrid
        heading="이런 게 가능해요"
        subheading="귀찮은 건 AI가, 재밌는 건 내가"
        features={[
          {
            icon: <Zap className="w-5 h-5" />,
            title: "사진 찍고, 5분만 기다리세요",
            description:
              "장소 이름과 사진만 올리면 AI가 한국어·영어 블로그 글을 동시에 작성해요. 메뉴 정보, 별점, 메모를 추가하면 더 풍부한 글이 나옵니다.",
            warm: false,
          },
          {
            icon: <Globe className="w-5 h-5" />,
            title: "한국어·영어, 한 번에",
            description:
              "번역이 아니라, 각 언어에 맞게 따로 써요. 영어 글은 외국인 관점으로.",
            warm: true,
          },
          {
            icon: <PenTool className="w-5 h-5" />,
            title: "내 말투 그대로",
            description:
              "내가 쓴 글 샘플을 학습해서 내 스타일로 써줘요. ㅋㅋ부터 존댓말까지.",
            warm: false,
          },
          {
            icon: <Search className="w-5 h-5" />,
            title: "알아서 찾아주는 장소 정보",
            description:
              "네이버·구글에서 후기, 인기 메뉴, 주차 팁까지 자동 수집해서 글에 녹여요.",
            warm: true,
          },
          {
            icon: <BarChart3 className="w-5 h-5" />,
            title: "네이버·티스토리·미디엄 맞춤",
            description:
              "플랫폼마다 다른 SEO 규칙에 맞춰 글을 최적화해드려요.",
            warm: false,
          },
          {
            icon: <Shield className="w-5 h-5" />,
            title: "어색한 문장? 자동으로 잡아줍니다",
            description:
              "글 길이, 사진 배치, AI 투 문장을 자동 검사하고, 기준 미달이면 다시 써요.",
            warm: true,
          },
        ]}
      />

      <HowItWorks />

      <CtaSection
        heading="첫 글은 무료예요"
        description="회원가입하고 사진 한 장 올려보세요. 5분 후에 블로그 글이 준비됩니다."
        ctaText="무료로 시작하기"
        ctaHref="/signup"
      />

      <Footer />
    </div>
  );
}
