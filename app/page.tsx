import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <h1 style={{ marginTop: 0 }}>RepoRAG Explorer</h1>
      <p style={{ color: "#a7adbb" }}>
        AI Codebase Explorer using RAG (Retrieval Augmented Generation)
      </p>
      <Link
        href="/explorer"
        style={{
          display: "inline-block",
          marginTop: 12,
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid #2e3850",
          background: "#1b2231",
          textDecoration: "none",
        }}
      >
        Open Explorer
      </Link>
    </main>
  );
}
