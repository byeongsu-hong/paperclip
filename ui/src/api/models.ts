import { api } from "./client";

export type CliAuthStatus = "authenticated" | "unauthenticated" | "not-installed";

export const modelsApi = {
  getStatus: () =>
    api.get<{ statuses: Record<string, CliAuthStatus> }>("/models/status"),

  initWorkspace: () =>
    api.post<{ result: { workspaceDir: string; agentsDir: string; docsDir: string; alreadyExisted: boolean } }>(
      "/workspace/init",
      {}
    ),
};
