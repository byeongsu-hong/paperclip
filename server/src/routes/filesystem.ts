import { Router } from "express";
import path from "node:path";
import { listDirectory, readFile, getWorkspaceRoot, sandboxPath } from "../services/filesystem.js";
import { forbidden, badRequest } from "../errors.js";

export function filesystemRoutes() {
  const router = Router();

  function assertBoard(req: any, res: any, next: any) {
    if (req.actor?.type !== "board") throw forbidden("Board authentication required");
    next();
  }

  router.get("/filesystem", assertBoard, (req, res) => {
    const dirPath = (req.query.path as string) || getWorkspaceRoot();
    const absPath = path.isAbsolute(dirPath)
      ? dirPath
      : path.join(getWorkspaceRoot(), dirPath);
    try {
      const entries = listDirectory(absPath);
      res.json({ entries, root: getWorkspaceRoot() });
    } catch (e: any) {
      if (e.message?.includes("Path traversal")) throw badRequest("Invalid path");
      throw e;
    }
  });

  router.get("/filesystem/file", assertBoard, (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) throw badRequest("path required");
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(getWorkspaceRoot(), filePath);
    try {
      const content = readFile(absPath);
      res.json({ content, path: filePath });
    } catch (e: any) {
      if (e.message?.includes("Path traversal")) throw badRequest("Invalid path");
      throw e;
    }
  });

  return router;
}
