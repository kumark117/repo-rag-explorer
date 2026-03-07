import { NextResponse } from "next/server";
import { chunkFiles } from "@/lib/chunker";
import { embedTexts } from "@/lib/embeddings";
import { downloadAndReadRepository } from "@/lib/githubLoader";
import { vectorStore } from "@/lib/vectorStore";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_UI_FILES = 200;
const MAX_UI_FILE_CHARS = 12_000;
const MAX_INGEST_FILES = 180;
const MAX_INGEST_CHUNKS = 450;

export async function POST(request: Request) {
  try {
    const { repoUrl } = (await request.json()) as { repoUrl?: string };

    if (!repoUrl || typeof repoUrl !== "string") {
      return NextResponse.json(
        { error: "repoUrl is required." },
        { status: 400 }
      );
    }

    const loadedRepo = await downloadAndReadRepository(repoUrl);
    const filesForIndexing = loadedRepo.files.slice(0, MAX_INGEST_FILES);
    const chunks = chunkFiles(filesForIndexing);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No supported source files found in the repository." },
        { status: 400 }
      );
    }

    const chunksForIndexing = chunks.slice(0, MAX_INGEST_CHUNKS);

    const vectors = await embedTexts(chunksForIndexing.map((chunk) => chunk.text));
    if (vectors.length !== chunksForIndexing.length) {
      throw new Error("Embedding generation returned an unexpected vector count.");
    }

    await vectorStore.clear();
    await vectorStore.addEmbeddings(chunksForIndexing, vectors);

    const uiFiles = loadedRepo.files.slice(0, MAX_UI_FILES).map((file) => ({
      ...file,
      content: file.content.slice(0, MAX_UI_FILE_CHARS),
    }));

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

    console.error("[ingest] failed", details);

    return NextResponse.json(
      {
        error: details.message || "Ingestion failed.",
        details: {
          name: details.name,
          hint:
            "Check Vercel function logs for '[ingest] failed' and stack trace. Common causes: invalid OpenAI/Pinecone configuration, index dimension mismatch, or external API timeout.",
        },
      },
      { status: 500 }
    );
  }
}
