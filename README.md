# RepoRAG Explorer

AI Codebase Explorer using RAG (Retrieval Augmented Generation).

RepoRAG Explorer ingests a GitHub repository, chunks source files, generates embeddings, stores vectors in Pinecone, and answers architecture/code questions using retrieval-grounded responses.

## Project Overview

- Framework: Next.js (App Router) + React + TypeScript
- APIs: Node.js route handlers
- Embeddings: OpenAI `text-embedding-3-small`
- LLM: OpenAI `gpt-4o-mini`
- Storage: Pinecone vector database (with automatic in-memory fallback if Pinecone env is not set)

## Architecture Diagram (ASCII)

```text
             ┌───────────────────────┐
             │       Frontend        │
             │ Repo URL + 3-panel UI │
             └───────────┬───────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ API Layer    │
                  │ /api/ingest  │
                  │ /api/query   │
                  └──────┬───────┘
                         │
      ┌──────────────────┴───────────────────┐
      │                                      │
      ▼                                      ▼
┌───────────────┐                    ┌────────────────┐
│ Ingestion     │                    │ Query Pipeline │
│ 1) Download   │                    │ 1) Embed Q     │
│ 2) Scan files │                    │ 2) Similarity  │
│ 3) Chunk text │                    │ 3) Top chunks  │
│ 4) Embeddings │                    │ 4) GPT answer  │
│ 5) Vector add │                    │ grounded in    │
└──────┬────────┘                    │ retrieved code │
       │                             └────────────────┘
       ▼
┌──────────────────────┐
│  Pinecone Vector DB  │
│ (cosine similarity)  │
└──────────────────────┘
```

## How RAG Works in This Project

1. The ingestion endpoint downloads a GitHub repository as a zip archive.
2. It extracts supported source files (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.md`).
3. File content is split into 500-800 character chunks.
4. Each chunk is converted into an embedding vector.
5. Vectors are stored in Pinecone with metadata (file path/name + chunk text).
6. On query, the question is embedded and compared to stored vectors.
7. Top matching chunks are passed to `gpt-4o-mini` to produce a grounded answer.

## Folder Structure

```text
repo-rag-explorer/
├─ app/
│  ├─ api/
│  │  ├─ ingest/route.ts
│  │  └─ query/route.ts
│  ├─ explorer/page.tsx
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ components/
│  ├─ ChatPanel.tsx
│  ├─ CodeViewer.tsx
│  ├─ ExplorerLayout.tsx
│  ├─ FileTree.tsx
│  └─ RepoLoader.tsx
├─ lib/
│  ├─ chunker.ts
│  ├─ embeddings.ts
│  ├─ githubLoader.ts
│  ├─ ragPipeline.ts
│  ├─ types.ts
│  └─ vectorStore.ts
├─ .env.example
├─ package.json
└─ README.md
```

## Environment Variables

Create `.env.local`:

```bash
OPENAI_API_KEY=your_openai_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=your_index_name
PINECONE_NAMESPACE=repo-rag-default
```

Pinecone index requirements:
- Dimension: `1536` (for `text-embedding-3-small`)
- Metric: `cosine`
- Type: Serverless index

## Local Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000 and navigate to `/explorer`.

## Usage

1. Enter a GitHub repository URL.
2. Click **Index Repository**.
3. Ask questions in the chat panel, for example:
   - Where is authentication implemented?
   - Explain architecture of this repo.
   - Which files contain API calls?

## Deployment (Vercel)

1. Push the project to GitHub.
2. Import the repository in Vercel.
3. Set environment variables `OPENAI_API_KEY`, `PINECONE_API_KEY`, and `PINECONE_INDEX_NAME` in Vercel project settings.
4. Deploy.

Notes:
- With Pinecone configured, vectors persist across serverless invocations and redeploys.
- If Pinecone env vars are omitted, app falls back to in-memory vectors for local demo use.
