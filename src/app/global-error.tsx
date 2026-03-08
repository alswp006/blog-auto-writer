"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ background: "#0a0a0f", color: "#e8e8f0", fontFamily: "system-ui, sans-serif", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "3rem", fontWeight: "bold", color: "#666680", marginBottom: "1rem" }}>500</h1>
        <p style={{ fontSize: "1.125rem", color: "#a8a8b8", marginBottom: "1.5rem" }}>오류가 발생했습니다</p>
        <p style={{ fontSize: "0.75rem", color: "#666", marginBottom: "1rem", maxWidth: "400px", wordBreak: "break-all" }}>{error.message}</p>
        {error.digest && <p style={{ fontSize: "0.625rem", color: "#555", marginBottom: "1rem" }}>Digest: {error.digest}</p>}
        <button
          onClick={() => reset()}
          style={{
            padding: "0.75rem 1.5rem",
            borderRadius: "0.75rem",
            background: "#6366f1",
            color: "white",
            fontWeight: 500,
            fontSize: "0.875rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
