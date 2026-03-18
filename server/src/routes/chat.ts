import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { chatService } from "../services/chat.js";
import { forbidden } from "../errors.js";

export function chatRoutes(db: Db) {
  const router = Router();
  const svc = chatService(db);

  function assertBoard(req: any, res: any, next: any) {
    if (req.actor?.type !== "board") throw forbidden("Board authentication required");
    next();
  }

  router.get("/companies/:companyId/chat/sessions", assertBoard, async (req, res) => {
    const sessions = await svc.listSessions(req.params.companyId);
    res.json({ sessions });
  });

  router.post("/companies/:companyId/chat/sessions", assertBoard, async (req, res) => {
    const session = await svc.createSession(req.params.companyId, req.actor.userId!, req.body.title);
    res.status(201).json({ session });
  });

  router.get("/chat/sessions/:sessionId/messages", assertBoard, async (req, res) => {
    const messages = await svc.listMessages(req.params.sessionId);
    res.json({ messages });
  });

  router.post("/chat/sessions/:sessionId/messages", assertBoard, async (req, res) => {
    const { content } = req.body;
    const msg = await svc.addMessage(req.params.sessionId, "user", content, req.actor.userId);
    res.status(201).json({ message: msg });
  });

  return router;
}
