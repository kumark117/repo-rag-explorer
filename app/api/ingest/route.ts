import { NextResponse } from "next/server";
import { chunkFiles } from "@/lib/chunker";
import { embedTexts } from "@/lib/embeddings";
import { downloadAndReadRepository } from "@/lib/githubLoader";
import { vectorStore } from "@/lib/vectorStore";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_UI_FILES = 200;
const MAX_UI_FILE_CHARS = 12_000;

function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

const MAX_INGEST_FILES = parseEnvInt("MAX_INGEST_FILES", 60);
const MAX_INGEST_CHUNKS = parseEnvInt("MAX_INGEST_CHUNKS", 120);

function isTransientConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("connection error") ||
    message.includes("fetch failed") ||
    message.includes("socket") ||
    message.includes("timeout") ||
    message.includes("econn")
  );
}

async function withRetry<T>(
  operation: () => Promise<T>,
  attempts: number,
  label: string
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < attempts && isTransientConnectionError(error);

      if (!canRetry) {
        throw error;
      }

      const delayMs = 750 * attempt;
      console.warn(`[ingest] transient failure in ${label}, retrying`, {
        attempt,
        attempts,
        delayMs,
        message: error instanceof Error ? error.message : String(error),
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

export async function POST(request: Request) {
  let phase = "parse_request";
  const startedAt = Date.now();

  try {
    phase = "read_body";
    const { repoUrl } = (await request.json()) as { repoUrl?: string };

    if (!repoUrl || typeof repoUrl !== "string") {
      return NextResponse.json(
        { error: "repoUrl is required." },
        { status: 400 }
      );
    }

    phase = "download_repo";
    const loadedRepo = await downloadAndReadRepository(repoUrl);

    phase = "chunk_files";
    const filesForIndexing = loadedRepo.files.slice(0, MAX_INGEST_FILES);
    const chunks = chunkFiles(filesForIndexing);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No supported source files found in the repository." },
        { status: 400 }
      );
    }

    phase = "embed_chunks";
    const chunksForIndexing = chunks.slice(0, MAX_INGEST_CHUNKS);

    const vectors = await embedTexts(chunksForIndexing.map((chunk) => chunk.text));
    if (vectors.length !== chunksForIndexing.length) {
      throw new Error("Embedding generation returned an unexpected vector count.");
    }

    phase = "vector_store_clear";
    await withRetry(() => Promise.resolve(vectorStore.clear()), 2, "vector_store_clear");

    phase = "vector_store_upsert";
    await withRetry(
      () => Promise.resolve(vectorStore.addEmbeddings(chunksForIndexing, vectors)),
      2,
      "vector_store_upsert"
    );

    phase = "prepare_ui_payload";
    const uiFiles = loadedRepo.files.slice(0, MAX_UI_FILES).map((file) => ({
      ...file,
      content: file.content.slice(0, MAX_UI_FILE_CHARS),
    }));

    const durationMs = Date.now() - startedAt;
    console.info("[ingest] completed", {
      phase: "done",
      durationMs,
      filesIndexed: filesForIndexing.length,
      chunksIndexed: chunksForIndexing.length,
      repo: `${loadedRepo.owner}/${loadedRepo.name}`,
    });

    return NextResponse.json({
      success: true,
      repo: {
        owner: loadedRepo.owner,
        name: loadedRepo.name,
        branch: loadedRepo.branch,
      },
      stats: {
        files: filesForIndexing.length,
        chunks: chunksForIndexing.length,
      },
      files: uiFiles,
      ui: {
        returnedFiles: uiFiles.length,
        totalFiles: loadedRepo.files.length,
        indexedFiles: filesForIndexing.length,
        indexedChunks: chunksForIndexing.length,
        totalChunks: chunks.length,
        truncated:
          loadedRepo.files.length > MAX_UI_FILES ||
          loadedRepo.files.some((file) => file.content.length > MAX_UI_FILE_CHARS) ||
          loadedRepo.files.length > MAX_INGEST_FILES ||
          chunks.length > MAX_INGEST_CHUNKS,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const details =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : {
            name: "UnknownError",
            message: String(error),
            stack: undefined,
          };

    console.error("[ingest] failed", {
      phase,
      durationMs,
      ...details,
    });

    return NextResponse.json(
      {
        error: `${phase}: ${details.message || "Ingestion failed."}`,
        details: {
          phase,
          durationMs,
          name: details.name,
          hint:
            "Check Vercel function logs for '[ingest] failed' and stack trace. Common causes: invalid OpenAI/Pinecone configuration, index dimension mismatch, or external API timeout.",
        },
      },
      { status: 500 }
    );
  }
}
