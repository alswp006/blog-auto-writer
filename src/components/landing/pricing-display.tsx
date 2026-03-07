import { PricingSection } from "@/components/pricing-section";
import type { Plan } from "@/components/pricing-section";

interface PricingDisplayProps {
  heading?: string;
  subheading?: string;
  plans: Plan[];
}

export function PricingDisplay({
  heading = "Pricing",
  subheading = "Choose the plan that works for you",
  plans,
}: PricingDisplayProps) {
  return (
    <section className="space-y-10 py-12">
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-bold text-[var(--text)]">{heading}</h2>
        <p className="text-sm text-[var(--text-secondary)]">{subheading}</p>
      </div>
      <PricingSection plans={plans} />
    </section>
  );
}
