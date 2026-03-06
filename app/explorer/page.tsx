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
  const [indexStatus, setIndexStatus] = useState<string>(
    "No repository indexed yet."
  );

  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedPath) ?? null,
    [files, selectedPath]
  );

  const handleIngested = (
    nextFiles: RepoFile[],
    statusMessage: string,
    defaultPath?: string
  ) => {
    setFiles(nextFiles);
    setSelectedPath(defaultPath ?? nextFiles[0]?.path ?? "");
    setIndexStatus(statusMessage);
  };

  return (
    <main className="container" style={{ display: "grid", gap: 14 }}>
      <h1 style={{ margin: 0 }}>Repo RAG AI Explorer</h1>
        <div>AI Codebase Explorer using RAG (Retrieval Augmented Generation)
        <br/>Nextjs + Typescript + RAG AI --- openAI project</div>
      <RepoLoader onIngested={handleIngested} onStatusChange={setIndexStatus} />
      <div
        className="panel"
        style={{ padding: 10, fontSize: 13, color: "#a7adbb", minHeight: 40 }}
      >
        {indexStatus}
      </div>
      <ExplorerLayout
        left={<FileTree files={files} selectedPath={selectedPath} onSelect={setSelectedPath} />}
        middle={<CodeViewer file={selectedFile} />}
        right={<ChatPanel />}
      />
    </main>
  );
}
