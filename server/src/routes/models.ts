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

  router.post("/workspace/init", assertBoard, (_req, res) => {
    const result = initAgentWorkspace();
    res.json({ result });
  });

  return router;
}
