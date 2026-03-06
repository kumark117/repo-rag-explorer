"use client";

import { useState } from "react";
import type { QueryResponse } from "@/lib/types";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    const nextQuestion = question.trim();
    if (!nextQuestion) {
      return;
    }

    setMessages((prev) => [...prev, { role: "user", text: nextQuestion }]);
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

      setMessages((prev) => [...prev, { role: "assistant", text: responseText }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: error instanceof Error ? error.message : "Failed to fetch answer.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <aside className="panel" style={{ overflow: "hidden", display: "grid", gridTemplateRows: "auto 1fr auto" }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #2a2f3a", fontWeight: 600 }}>
        AI Chat
      </div>

      <div style={{ overflow: "auto", padding: 12, display: "grid", gap: 8 }}>
        {messages.length === 0 ? (
          <p style={{ margin: 0, color: "#9ba3b4", fontSize: 13 }}>
            Ask a question about the indexed repository.
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              style={{
                border: "1px solid #2a2f3a",
                borderRadius: 8,
                background: message.role === "user" ? "#10213f" : "#141a26",
                padding: "8px 10px",
                fontSize: 13,
                whiteSpace: "pre-wrap",
              }}
            >
              <strong style={{ display: "block", marginBottom: 4 }}>
                {message.role === "user" ? "You" : "AI"}
              </strong>
              {message.text}
            </div>
          ))
        )}
      </div>

      <div style={{ borderTop: "1px solid #2a2f3a", padding: 10, display: "grid", gap: 8 }}>
        <textarea
          rows={3}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about architecture, auth, API calls..."
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
            justifySelf: "end",
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
    </aside>
  );
}
