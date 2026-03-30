import { Camera, Sparkles, Send } from "lucide-react";

const steps = [
  {
    icon: <Camera className="w-5 h-5" />,
    number: "01",
    title: "사진과 메모 올리기",
    description: "방문한 장소 사진을 올리고, 메모 한 줄만 남겨주세요. 장소 이름만 입력하면 메뉴와 주소는 자동으로 찾아요.",
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    number: "02",
    title: "AI가 글 작성",
    description: "장소 정보를 네이버·구글에서 자동 보강하고, 사진을 분석해서 한국어·영어 글을 동시에 써요.",
  },
  {
    icon: <Send className="w-5 h-5" />,
    number: "03",
    title: "수정하고 발행",
    description: "생성된 글을 원하는 대로 다듬고, 네이버 블로그·티스토리·미디엄에 바로 발행하세요.",
  },
];

export function HowItWorks() {
  return (
    <section className="w-full py-24 md:py-32 bg-[var(--bg-elevated)]">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 space-y-16">
        <div className="max-w-xl space-y-3 fade-in-up">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--text)]">
            이렇게 쉬워요
          </h2>
          <p className="text-base leading-relaxed text-[var(--text-secondary)]">
            3단계면 전문 블로거 부럽지 않은 포스팅 완성
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {steps.map((step, i) => {
            const isMiddle = i === 1;

            return (
              <div
                key={step.number}
                className={`relative flex flex-col space-y-5 fade-in-up fade-in-up-delay-${i + 1}`}
              >
                {/* Step number + icon row */}
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-[var(--accent)] tabular-nums">
                    {step.number}
                  </span>
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor: isMiddle ? "var(--warm-soft)" : "var(--accent-soft)",
                      color: isMiddle ? "var(--warm)" : "var(--accent)",
                    }}
                  >
                    {step.icon}
                  </div>
                </div>

                <h3 className="text-lg font-bold text-[var(--text)]">
                  {step.title}
                </h3>

                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
