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

    let timeoutId: number | undefined;

    try {
      const controller = new AbortController();
      timeoutId = window.setTimeout(() => controller.abort(), 240_000);

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

      const successData = data as IngestResponse;
      const status = `Indexed ${successData.stats.files} files into ${successData.stats.chunks} chunks from ${successData.repo.owner}/${successData.repo.name} (${successData.repo.branch}).`;
      onIngested(successData.files, status, successData.files[0]?.path);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          onStatusChange(
            "Indexing timed out. Try a smaller repository or retry with fewer files."
          );
          return;
        }

        if (error.message === "Failed to fetch") {
          onStatusChange(
            "Cannot reach /api/ingest. Ensure the app server is running and reachable."
          );
          return;
        }

        onStatusChange(error.message);
        return;
      }

      onStatusChange("Ingestion failed.");
    } finally {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
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
