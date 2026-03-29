import type { ReactNode } from "react";

interface Feature {
  icon: ReactNode;
  title: string;
  description: string;
  warm?: boolean; // alternate color: amber instead of indigo
}

interface FeatureGridProps {
  heading?: string;
  subheading?: string;
  features: Feature[];
}

export function FeatureGrid({ heading, subheading, features }: FeatureGridProps) {
  return (
    <section className="w-full py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 space-y-12">
        {(heading || subheading) && (
          <div className="text-center space-y-3 fade-in-up">
            {heading && (
              <h2 className="text-3xl font-bold tracking-tight text-[var(--text)]">{heading}</h2>
            )}
            {subheading && (
              <p className="text-base leading-relaxed text-[var(--text-secondary)] max-w-lg mx-auto">
                {subheading}
              </p>
            )}
          </div>
        )}

        {/* Asymmetric grid: first item spans 2 cols on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => {
            const isHero = i === 0;
            const isWarm = feature.warm ?? (i % 2 === 1);
            const accentColor = isWarm ? "var(--warm)" : "var(--accent)";
            const softBg = isWarm ? "var(--warm-soft)" : "var(--accent-soft)";

            return (
              <div
                key={feature.title}
                className={`
                  rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]
                  space-y-4 hover-lift
                  ${isHero ? "md:col-span-2 lg:col-span-2 p-8 md:p-10" : "p-6 md:p-7"}
                `}
              >
                <div
                  className="rounded-xl w-11 h-11 flex items-center justify-center"
                  style={{ backgroundColor: softBg }}
                >
                  <span style={{ color: accentColor }}>{feature.icon}</span>
                </div>
                <h3 className={`font-bold text-[var(--text)] ${isHero ? "text-xl" : "text-base"}`}>
                  {feature.title}
                </h3>
                <p className={`leading-relaxed text-[var(--text-secondary)] ${isHero ? "text-base max-w-lg" : "text-sm"}`}>
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
