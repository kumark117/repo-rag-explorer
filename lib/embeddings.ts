import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_BATCH_SIZE = 8;
const EMBEDDING_RETRY_ATTEMPTS = 6;

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

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return new OpenAI({
    apiKey,
    maxRetries: 5,
    timeout: 120_000,
  });
}

export async function embedText(text: string): Promise<number[]> {
  const client = getClient();
  const response = await withEmbeddingRetry(() =>
    client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    })
  );

  return response.data[0].embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const client = getClient();
  const vectors: number[][] = [];
  const batchSize = EMBEDDING_BATCH_SIZE;

  for (let index = 0; index < texts.length; index += batchSize) {
    const batch = texts.slice(index, index + batchSize);

    try {
      const response = await withEmbeddingRetry(() =>
        client.embeddings.create({
          model: EMBEDDING_MODEL,
          input: batch,
        })
      );

      response.data.forEach((item) => vectors.push(item.embedding));
    } catch (batchError) {
      if (!isTransientEmbeddingError(batchError)) {
        throw batchError;
      }

      console.warn("[embeddings] batch failed, falling back to single-item requests", {
        batchStart: index,
        batchSize: batch.length,
        message: batchError instanceof Error ? batchError.message : String(batchError),
      });

      for (const text of batch) {
        const response = await withEmbeddingRetry(() =>
          client.embeddings.create({
            model: EMBEDDING_MODEL,
            input: text,
          })
        );

        vectors.push(response.data[0].embedding);
      }
    }
  }

  return vectors;
}
