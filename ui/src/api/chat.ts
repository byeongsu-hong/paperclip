import { api } from "./client";

export type ChatSession = { id: string; title: string | null; createdAt: string; updatedAt: string };
export type ChatMessage = { id: string; sessionId: string; role: "user" | "assistant"; content: string; createdAt: string };

export const chatApi = {
  listSessions: (companyId: string) =>
    api.get<{ sessions: ChatSession[] }>(`/companies/${companyId}/chat/sessions`),

  createSession: (companyId: string, title?: string) =>
    api.post<{ session: ChatSession }>(`/companies/${companyId}/chat/sessions`, { title }),

  listMessages: (sessionId: string) =>
    api.get<{ messages: ChatMessage[] }>(`/chat/sessions/${sessionId}/messages`),

  sendMessage: (sessionId: string, content: string) =>
    api.post<{ message: ChatMessage }>(`/chat/sessions/${sessionId}/messages`, { content }),
};
