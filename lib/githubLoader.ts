import AdmZip from "adm-zip";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import type { RepoFile } from "@/lib/types";

const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".md",
  ".json",
  ".yml",
  ".yaml",
]);
const IGNORED_DIRS = new Set(["node_modules", "dist", "build", ".git"]);
const MAX_FILE_BYTES = 220_000;

type ParsedRepo = {
  owner: string;
  name: string;
};

function parseGitHubRepoUrl(repoUrl: string): ParsedRepo {
  let url: URL;

  try {
    url = new URL(repoUrl);
  } catch {
    throw new Error("Invalid repository URL.");
  }

  if (!url.hostname.includes("github.com")) {
    throw new Error("Only github.com URLs are supported.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Repository URL must be in the form https://github.com/owner/repo.");
  }

  const owner = parts[0];
  const name = parts[1].replace(/\.git$/, "");

  if (!owner || !name) {
    throw new Error("Could not parse owner/repository from URL.");
  }

  return { owner, name };
}

function extname(filePath: string): string {
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1) {
    return "";
  }

  return filePath.slice(dotIndex).toLowerCase();
}

async function scanFiles(rootDir: string, currentDir = rootDir): Promise<RepoFile[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files: RepoFile[] = [];

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      const nestedFiles = await scanFiles(rootDir, fullPath);
      files.push(...nestedFiles);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = extname(entry.name);
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      continue;
    }

    const contentBuffer = await readFile(fullPath);
    if (contentBuffer.byteLength > MAX_FILE_BYTES) {
      continue;
    }

    const relativePath = relative(rootDir, fullPath).replaceAll("\\", "/");
    files.push({
      name: basename(fullPath),
      path: relativePath,
      content: contentBuffer.toString("utf8"),
    });
  }

  return files;
}

async function resolveDefaultBranch(owner: string, name: string): Promise<string | null> {
  const repoApiUrl = `https://api.github.com/repos/${owner}/${name}`;

  const response = await fetch(repoApiUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "RepoRAG-Explorer",
    },
  });

  if (!response.ok) {
    return null;
  }

  const json = (await response.json()) as { default_branch?: string };
  if (!json.default_branch || typeof json.default_branch !== "string") {
    return null;
  }

  return json.default_branch;
}

async function fetchRepoZip(owner: string, name: string): Promise<{ buffer: Buffer; branch: string }> {
  const defaultBranch = await resolveDefaultBranch(owner, name);
  const candidateBranches = [defaultBranch, "main", "master"].filter(
    (branch, index, list): branch is string => !!branch && list.indexOf(branch) === index
  );

  for (const branch of candidateBranches) {
    const zipUrl = `https://codeload.github.com/${owner}/${name}/zip/refs/heads/${branch}`;
    const response = await fetch(zipUrl);

    if (!response.ok) {
      continue;
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      branch,
    };
  }

  throw new Error("Could not download repository. Ensure the repo is public and branch exists.");
}

export async function downloadAndReadRepository(repoUrl: string): Promise<{
  owner: string;
  name: string;
  branch: string;
  files: RepoFile[];
}> {
  const { owner, name } = parseGitHubRepoUrl(repoUrl);
  const { buffer, branch } = await fetchRepoZip(owner, name);

  const tempDir = await mkdtemp(join(tmpdir(), "repo-rag-"));

  try {
    const zip = new AdmZip(buffer);
    zip.extractAllTo(tempDir, true);

    const extractedRoot = join(tempDir, `${name}-${branch}`);
    const files = await scanFiles(extractedRoot);

    return {
      owner,
      name,
      branch,
      files,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
