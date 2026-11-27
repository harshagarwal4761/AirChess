"use client";

import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#070a09",
        color: "#e7ecea",
      }}
    >
      <section
        style={{
          maxWidth: "440px",
          width: "100%",
          padding: "28px",
          borderRadius: "16px",
          background: "#101714",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          display: "grid",
          gap: "12px",
        }}
      >
        <span
          style={{
            fontSize: "0.75rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#34d399",
            fontWeight: 600,
          }}
        >
          AirChess
        </span>
        <h1 style={{ margin: 0, fontSize: "1.35rem" }}>Something interrupted the board</h1>
        <p style={{ margin: 0, color: "#9eb2a8", lineHeight: 1.5, fontSize: "0.95rem" }}>
          {error.message || "An unexpected client error occurred. Your local board state is safe to reload."}
        </p>
        <div style={{ display: "flex", gap: "10px", marginTop: "6px", flexWrap: "wrap" }}>
          <button type="button" className="button primary" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="button secondary">
            Return to board
          </Link>
        </div>
      </section>
    </main>
  );
}
