"use client";

import { useState } from "react";
import type { IngestResponse, RepoFile } from "@/lib/types";

type RepoLoaderProps = {
  onIndexStart: () => void;
  onIndexingChange: (isIndexing: boolean) => void;
  onRepoUrlChange: (repoUrl: string) => void;
  onIngested: (
    files: RepoFile[],
    statusMessage: string,
    defaultPath?: string,
    ui?: IngestResponse["ui"]
  ) => void;
  onStatusChange: (message: string) => void;
};

export default function RepoLoader({
  onIndexStart,
  onIndexingChange,
  onRepoUrlChange,
  onIngested,
  onStatusChange,
}: RepoLoaderProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleIngest = async () => {
    if (!repoUrl.trim()) {
      onStatusChange("Enter a GitHub repository URL.");
      return;
    }

    setIsLoading(true);
    onIndexingChange(true);
    onIndexStart();
    onStatusChange("Indexing repository...");

    try {
      const MAX_ATTEMPTS = 2;
      let successData: IngestResponse | null = null;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 180_000);

        try {
          const response = await fetch("/api/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repoUrl: repoUrl.trim() }),
            signal: controller.signal,
          });

          const raw = await response.text();
          let data: IngestResponse | { error: string };

          try {
            data = JSON.parse(raw) as IngestResponse | { error: string };
          } catch {
            throw new Error(raw || "Server returned an invalid response.");
          }

          if (!response.ok) {
            throw new Error("error" in data ? data.error : "Failed to ingest repository.");
          }

          successData = data as IngestResponse;
          break;
        } catch (error) {
          const canRetry =
            attempt < MAX_ATTEMPTS && error instanceof Error && error.message === "Failed to fetch";

          if (canRetry) {
            onStatusChange("Temporary network issue during indexing, retrying once...");
            await new Promise((resolve) => setTimeout(resolve, 1200));
            continue;
          }

          throw error;
        } finally {
          window.clearTimeout(timeoutId);
        }
      }

      if (!successData) {
        throw new Error("Failed to ingest repository.");
      }

      const baseStatus = `Indexed ${successData.stats.files} files into ${successData.stats.chunks} chunks from ${successData.repo.owner}/${successData.repo.name} (${successData.repo.branch}).`;
      const truncationStatus = successData.ui?.truncated
        ? ` Showing ${successData.ui.returnedFiles}/${successData.ui.totalFiles} files in UI, indexed ${successData.ui.indexedFiles}/${successData.ui.totalFiles} files (${successData.ui.indexedChunks}/${successData.ui.totalChunks} chunks).`
        : "";
      const status = `${baseStatus}${truncationStatus}`;
      onIngested(successData.files, status, successData.files[0]?.path, successData.ui);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          onStatusChange(
            "Indexing timed out. Please retry; if needed, use a smaller repository."
          );
          return;
        }

        if (error.message === "Failed to fetch") {
          onStatusChange(
            "Connection error while calling /api/ingest. This is usually a transient network/API issue; retry in a few seconds."
          );
          return;
        }

        onStatusChange(error.message);
        return;
      }

      onStatusChange("Ingestion failed.");
    } finally {
      setIsLoading(false);
      onIndexingChange(false);
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
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (!isLoading && repoUrl.trim().length > 0) {
                void handleIngest();
              }
            }
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            setRepoUrl(nextValue);
            onRepoUrlChange(nextValue);
          }}
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
          disabled={isLoading || repoUrl.trim().length === 0}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #30415f",
            background: isLoading || repoUrl.trim().length === 0 ? "#1f2937" : "#1d4ed8",
            color: "#fff",
            cursor: isLoading || repoUrl.trim().length === 0 ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "Indexing..." : "Index Repository"}
        </button>
      </div>
    </div>
  );
}
