import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const WORKSPACE_ROOT = path.join(process.env.PAPERCLIP_HOME ?? os.homedir(), "workspace");

export function sandboxPath(requestedPath: string, root: string = WORKSPACE_ROOT): string {
  const resolved = path.resolve(requestedPath);
  const rootResolved = path.resolve(root);
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    throw new Error(`Path traversal attempt: ${requestedPath}`);
  }
  return resolved;
}

export type FileEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: string;
};

export function listDirectory(dirPath: string): FileEntry[] {
  const safe = sandboxPath(dirPath);
  const entries = fs.readdirSync(safe, { withFileTypes: true });
  return entries
    .filter((e) => !e.name.startsWith("."))
    .map((e) => {
      const fullPath = path.join(safe, e.name);
      const relativePath = path.relative(WORKSPACE_ROOT, fullPath);
      const stat = fs.statSync(fullPath);
      return {
        name: e.name,
        path: relativePath,
        type: (e.isDirectory() ? "directory" : "file") as "file" | "directory",
        size: e.isFile() ? stat.size : undefined,
        modifiedAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function readFile(filePath: string): string {
  const safe = sandboxPath(filePath);
  return fs.readFileSync(safe, "utf8");
}

export function getWorkspaceRoot(): string {
  return WORKSPACE_ROOT;
}
