import type { Db } from "@paperclipai/db";
import { chatSessions, chatMessages } from "@paperclipai/db";
import { eq, desc } from "drizzle-orm";

export function chatService(db: Db) {
  return {
    async createSession(companyId: string, userId: string, title?: string) {
      const [session] = await db
        .insert(chatSessions)
        .values({ companyId, createdByUserId: userId, title: title ?? null })
        .returning();
      return session;
    },

    async listSessions(companyId: string) {
      return db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.companyId, companyId))
        .orderBy(desc(chatSessions.updatedAt));
    },

    async getSession(sessionId: string) {
      const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, sessionId));
      return session ?? null;
    },

    async addMessage(sessionId: string, role: "user" | "assistant", content: string, authorUserId?: string) {
      const [msg] = await db
        .insert(chatMessages)
        .values({ sessionId, role, content, authorUserId: authorUserId ?? null })
        .returning();
      await db
        .update(chatSessions)
        .set({ updatedAt: new Date() })
        .where(eq(chatSessions.id, sessionId));
      return msg;
    },

    async listMessages(sessionId: string) {
      return db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(chatMessages.createdAt);
    },
  };
}
