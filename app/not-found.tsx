import Link from "next/link";

export default function NotFound() {
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
          404 · Square not found
        </span>
        <h1 style={{ margin: 0, fontSize: "1.35rem" }}>That board page doesn&apos;t exist</h1>
        <p style={{ margin: 0, color: "#9eb2a8", lineHeight: 1.5, fontSize: "0.95rem" }}>
          Check the room code or replay link, or head back to the main AirChess board.
        </p>
        <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
          <Link href="/" className="button primary">
            Back to AirChess
          </Link>
        </div>
      </section>
    </main>
  );
}
