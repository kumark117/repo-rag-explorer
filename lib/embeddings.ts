import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small";

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
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  return response.data[0].embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const client = getClient();
  const vectors: number[][] = [];
  const batchSize = 100;

  for (let index = 0; index < texts.length; index += batchSize) {
    const batch = texts.slice(index, index + batchSize);
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });

    response.data.forEach((item) => vectors.push(item.embedding));
  }

  return vectors;
}
