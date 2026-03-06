"use client";

import type { RepoFile } from "@/lib/types";

type FileTreeProps = {
  files: RepoFile[];
  selectedPath: string;
  onSelect: (filePath: string) => void;
};

export default function FileTree({ files, selectedPath, onSelect }: FileTreeProps) {
  return (
    <aside className="panel" style={{ overflow: "hidden", display: "grid", gridTemplateRows: "auto 1fr" }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #2a2f3a", fontWeight: 600 }}>
        Files
      </div>
      <div style={{ overflow: "auto", padding: 8 }}>
        {files.length === 0 ? (
          <p style={{ margin: 8, color: "#9ba3b4", fontSize: 13 }}>
            File tree placeholder. Index a repository to load files.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
            {files.map((file) => {
              const active = file.path === selectedPath;
              return (
                <li key={file.path}>
                  <button
                    type="button"
                    onClick={() => onSelect(file.path)}
                    title={file.path}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "1px solid #2a2f3a",
                      background: active ? "#1e293b" : "#121722",
                      color: "#d6d9e0",
                      borderRadius: 6,
                      padding: "6px 8px",
                      cursor: "pointer",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {file.path}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
