import { createHash } from "node:crypto";
import { Pinecone } from "@pinecone-database/pinecone";
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

function getPineconeConfig() {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME;
  const rawNamespace = process.env.PINECONE_NAMESPACE ?? "repo-rag-default";
  const namespace = rawNamespace.trim() === "_default_" ? "repo-rag-default" : rawNamespace;

  if (!apiKey || !indexName) {
    return null;
  }

  return {
    apiKey,
    indexName,
    namespace,
  };
}

class HybridVectorStore {
  private readonly memoryStore = new InMemoryVectorStore();

  private pineconeClient: Pinecone | null = null;

  private getPineconeIndex() {
    const config = getPineconeConfig();
    if (!config) {
      return null;
    }

    if (!this.pineconeClient) {
      this.pineconeClient = new Pinecone({ apiKey: config.apiKey });
    }

    return {
      index: this.pineconeClient.index(config.indexName),
      namespace: config.namespace,
    };
  }

  private toVectorId(chunkId: string): string {
    return createHash("sha1").update(chunkId).digest("hex");
  }

  async clear() {
    const pinecone = this.getPineconeIndex();
    if (pinecone) {
      try {
        await pinecone.index.namespace(pinecone.namespace).deleteAll();
      } catch {
        return;
      }
      return;
    }

    this.memoryStore.clear();
  }

  async addEmbeddings(chunks: CodeChunk[], embeddings: number[][]) {
    const pinecone = this.getPineconeIndex();
    if (pinecone) {
      const namespaceIndex = pinecone.index.namespace(pinecone.namespace);
      const batchSize = 100;

      for (let index = 0; index < chunks.length; index += batchSize) {
        const chunkBatch = chunks.slice(index, index + batchSize);
        const vectorBatch = embeddings.slice(index, index + batchSize);

        await namespaceIndex.upsert(
          chunkBatch.map((chunk, batchIndex) => ({
            id: this.toVectorId(chunk.id),
            values: vectorBatch[batchIndex],
            metadata: {
              chunkId: chunk.id,
              fileName: chunk.fileName,
              filePath: chunk.filePath,
              text: chunk.text,
            },
          }))
        );
      }

      return;
    }

    chunks.forEach((chunk, index) => {
      this.memoryStore.addEmbedding(chunk, embeddings[index]);
    });
  }

  async searchSimilar(queryEmbedding: number[], topK = 5): Promise<SourceChunk[]> {
    const pinecone = this.getPineconeIndex();
    if (pinecone) {
      const queryResult = await pinecone.index.namespace(pinecone.namespace).query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
      });

      return (queryResult.matches ?? [])
        .filter((match) => match.metadata)
        .map((match) => ({
          id: String(match.metadata?.chunkId ?? match.id),
          fileName: String(match.metadata?.fileName ?? "unknown"),
          filePath: String(match.metadata?.filePath ?? "unknown"),
          text: String(match.metadata?.text ?? ""),
          score: match.score ?? 0,
        }));
    }

    return this.memoryStore.searchSimilar(queryEmbedding, topK);
  }

  async size() {
    const pinecone = this.getPineconeIndex();
    if (pinecone) {
      const stats = await pinecone.index.describeIndexStats();
      const namespaceStats = stats.namespaces?.[pinecone.namespace];
      return namespaceStats?.recordCount ?? 0;
    }

    return this.memoryStore.size();
  }
}

type VectorStoreApi = {
  clear: () => Promise<void> | void;
  size: () => Promise<number> | number;
  searchSimilar: (queryEmbedding: number[], topK?: number) => Promise<SourceChunk[]> | SourceChunk[];
  addEmbeddings?: (chunks: CodeChunk[], embeddings: number[][]) => Promise<void> | void;
};

function isCompatibleVectorStore(store: unknown): store is VectorStoreApi {
  if (!store || typeof store !== "object") {
    return false;
  }

  const candidate = store as Record<string, unknown>;
  return (
    typeof candidate.clear === "function" &&
    typeof candidate.size === "function" &&
    typeof candidate.searchSimilar === "function" &&
    typeof candidate.addEmbeddings === "function"
  );
}

const globalForVectorStore = globalThis as unknown as {
  __repoRagVectorStore?: unknown;
};

const existingStore = globalForVectorStore.__repoRagVectorStore;
export const vectorStore = isCompatibleVectorStore(existingStore)
  ? (existingStore as HybridVectorStore)
  : (globalForVectorStore.__repoRagVectorStore = new HybridVectorStore());
