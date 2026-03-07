"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PremiumGateProps {
  feature: string;
  children: React.ReactNode;
}

export function PremiumGate({ feature, children }: PremiumGateProps) {
  const [access, setAccess] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`/api/payments/access?feature=${encodeURIComponent(feature)}`)
      .then((r) => r.json())
      .then((data) => setAccess(data.hasAccess ?? true))
      .catch(() => setAccess(true)); // Default to open on error
  }, [feature]);

  // While loading, show children (no flash of upgrade prompt)
  if (access === null || access) {
    return <>{children}</>;
  }

  return (
    <div className="card p-6 text-center space-y-4">
      <div className="text-3xl">🔒</div>
      <h3 className="text-lg font-semibold text-[var(--text)]">
        Premium Feature
      </h3>
      <p className="text-sm text-[var(--text-secondary)]">
        Upgrade your plan to access this feature.
      </p>
      <Link
        href="/pricing"
        className="inline-block text-sm px-4 py-2 rounded-md bg-[var(--accent)] text-white no-underline hover:opacity-90 transition-all duration-150"
      >
        View Plans
      </Link>
    </div>
  );
}
