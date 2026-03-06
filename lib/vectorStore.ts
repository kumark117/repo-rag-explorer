import type { CodeChunk, SourceChunk } from "@/lib/types";

type VectorItem = {
  chunk: CodeChunk;
  embedding: number[];
};

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  if (denominator === 0) {
    return 0;
  }

  return dot / denominator;
}

class InMemoryVectorStore {
  private readonly items: VectorItem[] = [];

  addEmbedding(chunk: CodeChunk, embedding: number[]) {
    this.items.push({ chunk, embedding });
  }

  searchSimilar(queryEmbedding: number[], topK = 5): SourceChunk[] {
    const ranked = this.items
      .map((item) => ({
        item,
        score: cosineSimilarity(queryEmbedding, item.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ item, score }) => ({
        id: item.chunk.id,
        fileName: item.chunk.fileName,
        filePath: item.chunk.filePath,
        text: item.chunk.text,
        score,
      }));

    return ranked;
  }

  clear() {
    this.items.length = 0;
  }

  size() {
    return this.items.length;
  }
}

const globalForVectorStore = globalThis as unknown as {
  __repoRagVectorStore?: InMemoryVectorStore;
};

export const vectorStore =
  globalForVectorStore.__repoRagVectorStore ??
  (globalForVectorStore.__repoRagVectorStore = new InMemoryVectorStore());
