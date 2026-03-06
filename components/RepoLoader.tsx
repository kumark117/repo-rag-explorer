"use client";

import { useState } from "react";
import type { IngestResponse, RepoFile } from "@/lib/types";

type RepoLoaderProps = {
  onIngested: (files: RepoFile[], statusMessage: string, defaultPath?: string) => void;
  onStatusChange: (message: string) => void;
};

export default function RepoLoader({ onIngested, onStatusChange }: RepoLoaderProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleIngest = async () => {
    if (!repoUrl.trim()) {
      onStatusChange("Enter a GitHub repository URL.");
      return;
    }

    setIsLoading(true);
    onStatusChange("Indexing repository...");

    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: repoUrl.trim() }),
      });

      const data = (await response.json()) as IngestResponse | { error: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Failed to ingest repository.");
      }

      const successData = data as IngestResponse;
      const status = `Indexed ${successData.stats.files} files into ${successData.stats.chunks} chunks from ${successData.repo.owner}/${successData.repo.name} (${successData.repo.branch}).`;
      onIngested(successData.files, status, successData.files[0]?.path);
    } catch (error) {
      onStatusChange(error instanceof Error ? error.message : "Ingestion failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="panel" style={{ padding: 12, display: "grid", gap: 10 }}>
      <label htmlFor="repo-url" style={{ fontWeight: 600 }}>
        GitHub Repository URL
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
        <input
          id="repo-url"
          type="url"
          placeholder="https://github.com/owner/repo"
          value={repoUrl}
          onChange={(event) => setRepoUrl(event.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #2a2f3a",
            background: "#0f131c",
            color: "#e6e7ea",
          }}
        />
        <button
          type="button"
          onClick={handleIngest}
          disabled={isLoading}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #30415f",
            background: isLoading ? "#1f2937" : "#1d4ed8",
            color: "#fff",
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "Indexing..." : "Index Repository"}
        </button>
      </div>
    </div>
  );
}
