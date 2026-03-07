import type { CodeChunk, RepoFile } from "@/lib/types";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 100;

function splitTextIntoChunks(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n");

  if (normalized.length <= CHUNK_SIZE) {
    return [normalized];
  }

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    let end = Math.min(cursor + CHUNK_SIZE, normalized.length);

    if (end < normalized.length) {
      const window = normalized.slice(cursor, end + 80);
      const newlineIndex = window.lastIndexOf("\n");
      if (newlineIndex > 200) {
        end = cursor + newlineIndex;
      }
    }

    const chunk = normalized.slice(cursor, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) {
      break;
    }

    cursor = Math.max(end - CHUNK_OVERLAP, cursor + 1);
  }

  return chunks;
}

export function chunkFiles(files: RepoFile[]): CodeChunk[] {
  const allChunks: CodeChunk[] = [];

  for (const file of files) {
    const fileChunks = splitTextIntoChunks(file.content);

    fileChunks.forEach((text, index) => {
      allChunks.push({
        id: `${file.path}::${index}`,
        fileName: file.name,
        filePath: file.path,
        text,
      });
    });
  }

  return allChunks;
}
