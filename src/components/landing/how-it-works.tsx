import { Camera, Sparkles, Send } from "lucide-react";

const steps = [
  {
    icon: <Camera className="w-6 h-6" />,
    number: "01",
    title: "사진과 메모 업로드",
    description: "방문한 장소의 사진과 간단한 메모를 올려주세요. 장소 이름, 메뉴, 별점 정보를 입력하면 더 좋은 글이 나옵니다.",
  },
  {
    icon: <Sparkles className="w-6 h-6" />,
    number: "02",
    title: "AI가 글을 작성",
    description: "장소 정보를 자동으로 보강하고, 사진을 분석하여 한국어와 영어 블로그 글을 동시에 생성합니다.",
  },
  {
    icon: <Send className="w-6 h-6" />,
    number: "03",
    title: "검토 후 발행",
    description: "생성된 글을 편집하고, 네이버 블로그·티스토리·미디엄 등 원하는 플랫폼에 바로 발행하세요.",
  },
];

export function HowItWorks() {
  return (
    <section className="w-full py-20 md:py-28 bg-[var(--bg-elevated)]">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
            이용 방법
          </h2>
          <p className="text-base leading-relaxed text-[var(--text-secondary)] max-w-lg mx-auto">
            3단계만으로 전문적인 블로그 포스팅이 완성됩니다
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step, i) => (
            <div key={step.number} className="relative flex flex-col items-center text-center space-y-4">
              {/* Connector line (desktop only, between steps) */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-[var(--border)]" />
              )}

              <div className="relative z-10 w-16 h-16 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)]">
                {step.icon}
              </div>

              <span className="text-xs font-mono text-[var(--text-muted)] tracking-widest">
                STEP {step.number}
              </span>

              <h3 className="text-lg font-semibold text-[var(--text)]">
                {step.title}
              </h3>

              <p className="text-sm leading-relaxed text-[var(--text-secondary)] max-w-xs">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
