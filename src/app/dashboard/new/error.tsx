"use client";

export default function NewPostError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
      <h1 className="text-xl font-bold text-red-400">오류 발생</h1>
      <p className="text-sm text-[var(--text-muted)]">{error.message}</p>
      {error.digest && (
        <p className="text-xs text-[var(--text-muted)]">Digest: {error.digest}</p>
      )}
      <button
        onClick={() => reset()}
        className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm"
      >
        다시 시도
      </button>
    </div>
  );
}
