import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-[var(--text-muted)]">404</h1>
        <p className="text-lg text-[var(--text-secondary)]">Page not found</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-medium text-sm no-underline hover:opacity-90 transition-opacity"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
