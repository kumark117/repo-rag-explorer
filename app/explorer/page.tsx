"use client";

import { useMemo, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import CodeViewer from "@/components/CodeViewer";
import ExplorerLayout from "@/components/ExplorerLayout";
import FileTree from "@/components/FileTree";
import RepoLoader from "@/components/RepoLoader";
import type { RepoFile } from "@/lib/types";

export default function ExplorerPage() {
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [repoUrlInput, setRepoUrlInput] = useState("");
  const [chatSessionId, setChatSessionId] = useState(0);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexStatus, setIndexStatus] = useState<string>(
    "No repository indexed yet."
  );

  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedPath) ?? null,
    [files, selectedPath]
  );

  const canQuery = files.length > 0 && repoUrlInput.trim().length > 0;

  const handleIndexStart = () => {
    setFiles([]);
    setSelectedPath("");
    setIndexStatus("Indexing repository...");
    setChatSessionId((prev) => prev + 1);
  };

  const handleIngested = (
    nextFiles: RepoFile[],
    statusMessage: string,
    defaultPath?: string
  ) => {
    setFiles(nextFiles);
    setSelectedPath(defaultPath ?? nextFiles[0]?.path ?? "");
    setIndexStatus(statusMessage);
    setChatSessionId((prev) => prev + 1);
  };

  return (
    <main className="container" style={{ display: "grid", gap: 14 }}>
      <h1 style={{ margin: 0 }}>Repo RAG AI Explorer</h1>
        <div>AI Codebase Explorer using RAG (Retrieval Augmented Generation)
        <br/>Nextjs + Typescript + RAG AI --- openAI project</div>
      <RepoLoader
        onIndexStart={handleIndexStart}
        onIndexingChange={setIsIndexing}
        onRepoUrlChange={setRepoUrlInput}
        onIngested={handleIngested}
        onStatusChange={setIndexStatus}
      />
      <div
        className="panel"
        style={{ padding: 10, fontSize: 13, color: "#a7adbb", minHeight: 40 }}
      >
        {indexStatus}
      </div>
      <div style={{ position: "relative" }}>
        <ExplorerLayout
          left={<FileTree files={files} selectedPath={selectedPath} onSelect={setSelectedPath} />}
          middle={<CodeViewer file={selectedFile} />}
          right={
            <ChatPanel
              key={chatSessionId}
              canQuery={canQuery}
              isIndexing={isIndexing}
              indexStatus={indexStatus}
            />
          }
        />
        {isIndexing && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(8, 11, 17, 0.6)",
              display: "grid",
              placeItems: "center",
              borderRadius: 10,
            }}
          >
            <div
              className="indexing-overlay-card"
              style={{
                display: "grid",
                gap: 8,
                justifyItems: "center",
                padding: "12px 14px",
                border: "1px solid #2a2f3a",
                borderRadius: 10,
                background: "#111723",
              }}
            >
              <div className="indexing-spinner" />
              <div style={{ fontSize: 13, color: "#d6d9e0" }}>Indexing repository...</div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
