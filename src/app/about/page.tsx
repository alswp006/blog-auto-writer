import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STEPS = [
  {
    step: "1",
    title: "장소 정보 입력",
    desc: "맛집, 카페, 숙소, 여행지 — 방문한 장소의 이름, 카테고리, 주소, 메뉴/가격을 입력하세요. 네이버 지역 검색으로 자동 입력도 가능합니다.",
  },
  {
    step: "2",
    title: "사진 업로드",
    desc: "드래그앤드롭으로 사진을 올리세요. 최대 20장까지, HEIC도 자동 변환됩니다. 순서를 바꾸고 대표 사진을 지정할 수 있습니다.",
  },
  {
    step: "3",
    title: "AI 글 생성",
    desc: "문체 프로필을 선택하고 생성 버튼을 누르면, AI가 한국어+영어 블로그 글을 자동으로 작성합니다. 해시태그도 함께 생성됩니다.",
  },
  {
    step: "4",
    title: "편집 및 발행",
    desc: "생성된 글을 미리보기하고 수정할 수 있습니다. 네이버(HTML), 티스토리(마크다운), Medium(마크다운) 형식으로 복사하거나, 연동된 플랫폼에 자동 발행하세요.",
  },
];

const FEATURES = [
  {
    title: "한영 동시 생성",
    desc: "한국어와 영어 블로그 글을 한 번에 생성합니다. 외국인 관점의 자연스러운 영어 글이 특징입니다.",
  },
  {
    title: "카테고리별 글 구조",
    desc: "맛집, 카페, 숙소, 여행지 — 카테고리에 맞는 최적화된 글 구조를 자동으로 적용합니다.",
  },
  {
    title: "나이대별 문체 반영",
    desc: "20대 감성, 30대 친근함, 40대+ 차분함 — 설정한 나이대에 맞는 자연스러운 톤으로 글을 씁니다.",
  },
  {
    title: "커스텀 문체 프로필",
    desc: "본인이 쓴 글 샘플을 분석하여 나만의 문체를 학습합니다. AI가 내 스타일을 그대로 재현합니다.",
  },
  {
    title: "자동 발행",
    desc: "티스토리와 Medium에 연동하면 버튼 하나로 자동 발행됩니다. 발행 이력도 관리됩니다.",
  },
  {
    title: "사진 자동 리사이즈",
    desc: "업로드 시 1200px로 자동 리사이즈하고, HEIC 사진도 JPEG로 변환됩니다. 워터마크 기능도 지원합니다.",
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12 space-y-16">
      {/* Hero */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold">
          블로그 자동 작성기
        </h1>
        <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
          사진과 장소 정보만 입력하면 AI가 한국어/영어 블로그 글을 자동으로 작성해드립니다.
          가족 모두 쉽게 쓸 수 있는 블로그 도우미입니다.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button asChild>
            <Link href="/signup" className="no-underline">시작하기</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard" className="no-underline">대시보드</Link>
          </Button>
        </div>
      </div>

      {/* How it works */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-center">사용 방법</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STEPS.map((s) => (
            <Card key={s.step}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {s.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{s.title}</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-center">주요 기능</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <Card key={f.title} className="h-full">
              <CardContent className="p-5 space-y-2">
                <h3 className="font-semibold text-sm">{f.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Supported platforms */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-center">지원 플랫폼</h2>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Badge variant="secondary" className="text-sm px-4 py-1.5">네이버 블로그</Badge>
          <Badge variant="secondary" className="text-sm px-4 py-1.5">티스토리</Badge>
          <Badge variant="secondary" className="text-sm px-4 py-1.5">Medium</Badge>
        </div>
        <p className="text-xs text-[var(--text-muted)] text-center">
          네이버는 HTML 복사, 티스토리와 Medium은 자동 발행 또는 마크다운 복사를 지원합니다.
        </p>
      </div>

      {/* FAQ */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-center">자주 묻는 질문</h2>
        <div className="space-y-3 max-w-2xl mx-auto">
          {[
            {
              q: "어떤 AI를 사용하나요?",
              a: "OpenAI의 GPT-4o-mini 모델을 사용합니다. API 키가 없으면 기본 템플릿으로 글이 생성됩니다.",
            },
            {
              q: "사진은 어디에 저장되나요?",
              a: "서버의 public/uploads 폴더에 저장됩니다. 업로드 시 자동으로 리사이즈되어 용량을 절약합니다.",
            },
            {
              q: "영어 글은 어떻게 생성되나요?",
              a: "외국인이 한국을 여행하며 쓰는 관점으로 생성됩니다. 가격은 USD 환산, 교통편과 영어 메뉴 유무 등이 포함됩니다.",
            },
          ].map((item) => (
            <Card key={item.q}>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold">{item.q}</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">{item.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center space-y-3 pb-8">
        <p className="text-sm text-[var(--text-muted)]">지금 바로 시작해보세요</p>
        <Button asChild size="lg">
          <Link href="/signup" className="no-underline">회원가입하기</Link>
        </Button>
      </div>
    </div>
  );
}
