export type RepoFile = {
  name: string;
  path: string;
  content: string;
};

export type CodeChunk = {
  id: string;
  fileName: string;
  filePath: string;
  text: string;
};

export type SourceChunk = {
  id: string;
  fileName: string;
  filePath: string;
  text: string;
  score: number;
};

export type IngestResponse = {
  success: boolean;
  repo: {
    owner: string;
    name: string;
    branch: string;
  };
  stats: {
    files: number;
    chunks: number;
  };
  files: RepoFile[];
  ui?: {
    returnedFiles: number;
    totalFiles: number;
    indexedFiles: number;
    indexedChunks: number;
    totalChunks: number;
    truncated: boolean;
  };
};

export type QueryResponse = {
  answer: string;
  sources: SourceChunk[];
};
