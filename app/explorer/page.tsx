"use client";

import { useMemo, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import CodeViewer from "@/components/CodeViewer";
import ExplorerLayout from "@/components/ExplorerLayout";
import FileTree from "@/components/FileTree";
import RepoLoader from "@/components/RepoLoader";
import type { IngestResponse, RepoFile } from "@/lib/types";

export default function ExplorerPage() {
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [repoUrlInput, setRepoUrlInput] = useState("");
  const [chatSessionId, setChatSessionId] = useState(0);
  const [isIndexing, setIsIndexing] = useState(false);
  const [ingestUiSummary, setIngestUiSummary] = useState<IngestResponse["ui"]>();
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
    setIngestUiSummary(undefined);
    setIndexStatus("Indexing repository...");
    setChatSessionId((prev) => prev + 1);
  };

  const handleIngested = (
    nextFiles: RepoFile[],
    statusMessage: string,
    defaultPath?: string,
    ui?: IngestResponse["ui"]
  ) => {
    setFiles(nextFiles);
    setSelectedPath(defaultPath ?? nextFiles[0]?.path ?? "");
    setIngestUiSummary(ui);
    setIndexStatus(statusMessage);
    setChatSessionId((prev) => prev + 1);
  };

  return (
    <main className="container" style={{ display: "grid", gap: 14 }}>
      <h1 style={{ margin: 0, color: "#22c55e" }}>Repo RAG AI Explorer</h1>
        <div style={{ color: "#22c55e" }}>AI Codebase Explorer using RAG (Retrieval Augmented Generation)
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
        {ingestUiSummary && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#8f96a6" }}>
            Indexed: {ingestUiSummary.indexedFiles}/{ingestUiSummary.totalFiles} files, {" "}
            {ingestUiSummary.indexedChunks}/{ingestUiSummary.totalChunks} chunks.
            {ingestUiSummary.truncated ? " (truncated for performance)" : ""}
          </div>
        )}
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
