import type { RepoFile } from "@/lib/types";

type CodeViewerProps = {
  file: RepoFile | null;
};

export default function CodeViewer({ file }: CodeViewerProps) {
  return (
    <section className="panel" style={{ overflow: "hidden", display: "grid", gridTemplateRows: "auto 1fr" }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #2a2f3a", fontWeight: 600 }}>
        Code Viewer
      </div>
      <div style={{ overflow: "auto", padding: 12 }}>
        {!file ? (
          <p style={{ margin: 0, color: "#9ba3b4", fontSize: 13 }}>
            Code viewer placeholder. Select a file after ingestion.
          </p>
        ) : (
          <>
            <div style={{ marginBottom: 10, color: "#aab1c0", fontSize: 12 }}>{file.path}</div>
            <pre
              style={{
                margin: 0,
                border: "1px solid #2a2f3a",
                borderRadius: 8,
                background: "#0d1118",
                padding: 12,
                overflow: "auto",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              <code>{file.content}</code>
            </pre>
          </>
        )}
      </div>
    </section>
  );
}
