"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type Plan = {
  name: string;
  price: string;
  description?: string;
  features: string[];
  priceId: string;
  highlighted?: boolean;
};

interface PricingSectionProps {
  plans: Plan[];
}

const stripeEnabled = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export function PricingSection({ plans }: PricingSectionProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (priceId: string) => {
    if (!stripeEnabled) return;
    setLoading(priceId);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, mode: "subscription" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {plans.map((plan) => (
        <Card
          key={plan.name}
          className={`flex flex-col ${
            plan.highlighted
              ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
              : ""
          }`}
        >
          <CardContent className="pt-6 flex flex-col flex-1">
            <h3 className="text-lg font-semibold text-[var(--text)]">
              {plan.name}
            </h3>
            <div className="mt-2">
              <span className="text-2xl font-bold text-[var(--text)]">
                {plan.price}
              </span>
              {plan.price !== "Free" && plan.price !== "Custom" && (
                <span className="text-sm text-[var(--text-muted)]">/month</span>
              )}
            </div>
            {plan.description && (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {plan.description}
              </p>
            )}
            <ul className="mt-4 space-y-2 flex-1">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="text-sm text-[var(--text-secondary)] flex items-start gap-2"
                >
                  <span className="text-[var(--success)] mt-0.5">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {!stripeEnabled ? (
                <span className="block text-center text-sm text-[var(--text-muted)] py-2">
                  Coming Soon
                </span>
              ) : plan.price === "Free" ? (
                <span className="block text-center text-sm text-[var(--text-muted)] py-2">
                  Current Plan
                </span>
              ) : plan.price === "Custom" ? (
                <Button variant="outline" className="w-full" asChild>
                  <a href="mailto:sales@example.com" className="no-underline">
                    Contact Sales
                  </a>
                </Button>
              ) : (
                <Button
                  onClick={() => handleCheckout(plan.priceId)}
                  disabled={loading === plan.priceId}
                  variant={plan.highlighted ? "default" : "outline"}
                  className="w-full"
                >
                  {loading === plan.priceId ? "Redirecting..." : "Get Started"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
