"use client";

import { useState } from "react";
import type { QueryResponse } from "@/lib/types";

type QaPair = {
  id: string;
  question: string;
  answer: string | null;
  isError?: boolean;
};

export default function ChatPanel() {
  const [qaPairs, setQaPairs] = useState<QaPair[]>([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    const nextQuestion = question.trim();
    if (!nextQuestion) {
      return;
    }

    const pairId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setQaPairs((prev) => [
      {
        id: pairId,
        question: nextQuestion,
        answer: null,
      },
      ...prev,
    ]);
    setQuestion("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: nextQuestion }),
      });

      const data = (await response.json()) as QueryResponse | { error: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Query failed.");
      }

      const answerData = data as QueryResponse;
      const sourceList = answerData.sources.map((source) => source.filePath).join(", ");
      const responseText = sourceList
        ? `${answerData.answer}\n\nSources: ${sourceList}`
        : answerData.answer;

      setQaPairs((prev) =>
        prev.map((pair) =>
          pair.id === pairId
            ? {
                ...pair,
                answer: responseText,
                isError: false,
              }
            : pair
        )
      );
    } catch (error) {
      const errorText = error instanceof Error ? error.message : "Failed to fetch answer.";
      setQaPairs((prev) =>
        prev.map((pair) =>
          pair.id === pairId
            ? {
                ...pair,
                answer: errorText,
                isError: true,
              }
            : pair
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <aside className="panel" style={{ overflow: "hidden", display: "grid", gridTemplateRows: "auto auto 1fr" }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #2a2f3a", fontWeight: 600 }}>
        AI Chat
      </div>

      <div style={{ borderTop: "1px solid #2a2f3a", padding: 10, display: "grid", gap: 8 }}>
        <p style={{ margin: 0, color: "#9ba3b4", fontSize: 13 }}>
          Ask a question about the indexed repository.
        </p>
        <textarea
          rows={3}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Type your question here..."
          style={{
            width: "100%",
            borderRadius: 8,
            border: "1px solid #2a2f3a",
            background: "#0f131c",
            color: "#e6e7ea",
            padding: 10,
            resize: "vertical",
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #30415f",
            background: isLoading ? "#1f2937" : "#1d4ed8",
            color: "#fff",
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "Thinking..." : "Send"}
        </button>
      </div>

      <div style={{ overflow: "auto", padding: 12, display: "grid", gap: 8 }}>
        {qaPairs.length === 0 ? (
          <p style={{ margin: 0, color: "#9ba3b4", fontSize: 13 }}>
            No messages yet.
          </p>
        ) : (
          qaPairs.map((pair) => (
            <div
              key={pair.id}
              style={{
                border: "1px solid #2a2f3a",
                borderRadius: 8,
                background: "#141a26",
                padding: "8px 10px",
                fontSize: 13,
                display: "grid",
                gap: 8,
              }}
            >
              <div
                style={{
                  border: "1px solid #2a2f3a",
                  borderRadius: 8,
                  background: "#10213f",
                  padding: "8px 10px",
                  whiteSpace: "pre-wrap",
                }}
              >
                <strong style={{ display: "block", marginBottom: 4 }}>You</strong>
                {pair.question}
              </div>

              <div
                style={{
                  border: "1px solid #2a2f3a",
                  borderRadius: 8,
                  background: pair.isError ? "#3a1616" : "#1a2233",
                  padding: "8px 10px",
                  whiteSpace: "pre-wrap",
                }}
              >
                <strong style={{ display: "block", marginBottom: 4 }}>
                  {pair.answer ? "AI" : "AI (thinking...)"}
                </strong>
                {pair.answer ?? "Generating response..."}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
