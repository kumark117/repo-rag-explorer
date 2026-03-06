import { NextResponse } from "next/server";
import { chunkFiles } from "@/lib/chunker";
import { embedTexts } from "@/lib/embeddings";
import { downloadAndReadRepository } from "@/lib/githubLoader";
import { vectorStore } from "@/lib/vectorStore";

export const runtime = "nodejs";

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
    const chunks = chunkFiles(loadedRepo.files);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No supported source files found in the repository." },
        { status: 400 }
      );
    }

    const vectors = await embedTexts(chunks.map((chunk) => chunk.text));

    vectorStore.clear();

    chunks.forEach((chunk, index) => {
      vectorStore.addEmbedding(chunk, vectors[index]);
    });

    return NextResponse.json({
      success: true,
      repo: {
        owner: loadedRepo.owner,
        name: loadedRepo.name,
        branch: loadedRepo.branch,
      },
      stats: {
        files: loadedRepo.files.length,
        chunks: chunks.length,
      },
      files: loadedRepo.files,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingestion failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
