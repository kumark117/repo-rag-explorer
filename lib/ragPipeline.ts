import OpenAI from "openai";
import { embedText } from "@/lib/embeddings";
import type { QueryResponse } from "@/lib/types";
import { vectorStore } from "@/lib/vectorStore";

const CHAT_MODEL = "gpt-4o-mini";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return new OpenAI({ apiKey });
}

export async function answerQuestionWithRag(question: string): Promise<QueryResponse> {
  const queryEmbedding = await embedText(question);
  const sources = vectorStore.searchSimilar(queryEmbedding, 5);

  if (sources.length === 0) {
    return {
      answer: "No relevant code chunks were found. Please ingest a repository first.",
      sources: [],
    };
  }

  const chunkText = sources
    .map(
      (source, index) =>
        `Chunk ${index + 1}\nFile: ${source.filePath}\nCode:\n${source.text}`
    )
    .join("\n\n");

  const prompt = `You are a senior software engineer analyzing a codebase.

Question: ${question}

Relevant Code: ${chunkText}

Explain clearly and mention file names when possible.`;

  const client = getClient();
  const completion = await client.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You answer questions about a codebase using only the retrieved snippets. If uncertain, say what is missing.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const answer = completion.choices[0]?.message?.content?.trim() ?? "No answer generated.";

  return {
    answer,
    sources,
  };
}
