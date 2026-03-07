import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_BATCH_SIZE = 25;
const EMBEDDING_RETRY_ATTEMPTS = 4;

function isTransientEmbeddingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("connection error") ||
    message.includes("fetch failed") ||
    message.includes("socket") ||
    message.includes("timeout") ||
    message.includes("econn") ||
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

      const delayMs = 600 * attempt;
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
    const response = await withEmbeddingRetry(() =>
      client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      })
    );

    response.data.forEach((item) => vectors.push(item.embedding));
  }

  return vectors;
}
