interface Feature {
  icon: string;
  title: string;
  description: string;
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
          <div className="text-center space-y-3">
            {heading && (
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)]">{heading}</h2>
            )}
            {subheading && (
              <p className="text-base leading-relaxed text-[var(--text-secondary)] max-w-lg mx-auto">
                {subheading}
              </p>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 md:p-8 space-y-4 hover:shadow-lg hover:border-[var(--accent)]/30 transition-all duration-300"
            >
              <div className="rounded-xl w-12 h-12 flex items-center justify-center bg-[var(--accent)]/10 text-xl mb-4">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-[var(--text)]">
                {feature.title}
              </h3>
              <p className="text-base leading-relaxed text-[var(--text-secondary)]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
