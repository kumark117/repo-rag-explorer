import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_BATCH_SIZE = 8;
const EMBEDDING_RETRY_ATTEMPTS = 2;
const FALLBACK_EMBEDDING_DIMENSION = 1536;

function isTransientEmbeddingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const status = "status" in error && typeof error.status === "number" ? error.status : undefined;
  const isRetryableStatus = status !== undefined && (status === 429 || status >= 500);

  return (
    isRetryableStatus ||
    message.includes("connection error") ||
    message.includes("fetch failed") ||
    message.includes("socket") ||
    message.includes("etimedout") ||
    message.includes("timeout") ||
    message.includes("econn") ||
    message.includes("eai_again") ||
    message.includes("enotfound") ||
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("5xx")
  );
}

async function withEmbeddingRetry<T>(
  operation: () => Promise<T>,
  attempts = EMBEDDING_RETRY_ATTEMPTS
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < attempts && isTransientEmbeddingError(error);
      if (!canRetry) {
        throw error;
      }

      const backoffMs = Math.min(800 * 2 ** (attempt - 1), 8_000);
      const jitterMs = Math.floor(Math.random() * 300);
      const delayMs = backoffMs + jitterMs;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

function fnv1aHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function deterministicEmbedding(text: string, dimension = FALLBACK_EMBEDDING_DIMENSION): number[] {
  const vector = new Array<number>(dimension).fill(0);
  const normalized = text.toLowerCase();
  const tokens = normalized.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return vector;
  }

  for (const token of tokens) {
    const hash = fnv1aHash(token);
    const index = hash % dimension;
    const sign = (hash & 1) === 0 ? 1 : -1;
    vector[index] += sign;
  }

  let magnitude = 0;
  for (let i = 0; i < vector.length; i += 1) {
    magnitude += vector[i] * vector[i];
  }

  if (magnitude === 0) {
    return vector;
  }

  const norm = Math.sqrt(magnitude);
  return vector.map((value) => value / norm);
}

function fallbackEmbeddings(texts: string[]): number[][] {
  return texts.map((text) => deterministicEmbedding(text));
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return new OpenAI({
    apiKey,
    maxRetries: 2,
    timeout: 30_000,
  });
}

export async function embedText(text: string): Promise<number[]> {
  try {
    const client = getClient();
    const response = await withEmbeddingRetry(() =>
      client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
      })
    );

    return response.data[0].embedding;
  } catch (error) {
    if (!isTransientEmbeddingError(error)) {
      throw error;
    }

    console.warn("[embeddings] using deterministic fallback for single embedding", {
      message: error instanceof Error ? error.message : String(error),
    });

    return deterministicEmbedding(text);
  }
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  try {
    const client = getClient();
    const vectors: number[][] = [];
    const batchSize = EMBEDDING_BATCH_SIZE;

    for (let index = 0; index < texts.length; index += batchSize) {
      const batch = texts.slice(index, index + batchSize);
      const response = await withEmbeddingRetry(() =>
        client.embeddings.create({
          model: EMBEDDING_MODEL,
          input: batch,
        })
      );

      response.data.forEach((item) => vectors.push(item.embedding));
    }

    return vectors;
  } catch (error) {
    if (!isTransientEmbeddingError(error)) {
      throw error;
    }

    console.warn("[embeddings] using deterministic fallback for batch embeddings", {
      count: texts.length,
      message: error instanceof Error ? error.message : String(error),
    });

    return fallbackEmbeddings(texts);
  }
}
