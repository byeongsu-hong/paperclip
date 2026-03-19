import { spawnSync } from "node:child_process";
import os from "node:os";
import { Router } from "express";
import { checkAllCliStatusesAsync } from "../services/cli-auth.js";
import { initAgentWorkspace } from "../services/agent-workspace.js";
import { forbidden } from "../errors.js";

function assertBoard(req: any, res: any, next: any) {
  if (req.actor?.type !== "board") throw forbidden("Board authentication required");
  next();
}

export function modelsRoutes() {
  const router = Router();

  router.get("/models/status", assertBoard, async (_req, res) => {
    const statuses = await checkAllCliStatusesAsync();
    res.json({ statuses });
  });

  // Debug endpoint — no auth required, safe to expose (read-only system info)
  router.get("/models/debug", (_req, res) => {
    const clis = ["claude", "codex", "gemini"];
    const results: Record<string, unknown> = {
      home: os.homedir(),
      path: process.env.PATH,
      uid: process.getuid?.(),
      nodeVersion: process.version,
    };
    for (const cli of clis) {
      const which = spawnSync("which", [cli], { encoding: "utf8", timeout: 2000 });
      const version = spawnSync(cli, ["--version"], { encoding: "utf8", timeout: 3000 });
      results[cli] = {
        path: which.stdout.trim() || null,
        whichError: which.stderr.trim() || null,
        version: version.stdout.trim() || version.stderr.trim() || null,
        versionExit: version.status,
      };
    }
    try {
      const pty = require("@homebridge/node-pty-prebuilt-multiarch");
      results["node-pty"] = { available: true, type: typeof pty.spawn };
    } catch (e: any) {
      results["node-pty"] = { available: false, error: e?.message };
    }
    res.json(results);
  });

  router.post("/workspace/init", assertBoard, (_req, res) => {
    const result = initAgentWorkspace();
    res.json({ result });
  });

  return router;
}
