import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const AGENTS_MD_TEMPLATE = `# Agent Instructions

## Environment

This agent runs via Paperclip heartbeats.

Auto-injected:
- \`PAPERCLIP_API_URL\`, \`PAPERCLIP_API_KEY\`, \`PAPERCLIP_AGENT_ID\`
- \`PAPERCLIP_COMPANY_ID\`, \`PAPERCLIP_RUN_ID\`
- \`AGENT_HOME\` — this directory

## Workspace

- Working directory: \`~/workspace\`
- Docs: \`~/workspace/docs\`
- Agent home: \`~/workspace/agents\` (= \`$AGENT_HOME\`)

## Instructions

Use the \`pc\` CLI for all Paperclip API operations.`.trim();

export type WorkspaceInitResult = {
  workspaceDir: string;
  agentsDir: string;
  docsDir: string;
  agentsMdPath: string;
  alreadyExisted: boolean;
};

export function initAgentWorkspace(homeDir?: string): WorkspaceInitResult {
  const home = homeDir ?? os.homedir();
  const workspaceDir = path.join(home, "workspace");
  const agentsDir = path.join(workspaceDir, "agents");
  const docsDir = path.join(workspaceDir, "docs");
  const agentsMdPath = path.join(agentsDir, "AGENTS.md");

  const alreadyExisted = fs.existsSync(workspaceDir);

  for (const dir of [workspaceDir, agentsDir, docsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(agentsMdPath)) {
    fs.writeFileSync(agentsMdPath, AGENTS_MD_TEMPLATE, "utf8");
  }

  return { workspaceDir, agentsDir, docsDir, agentsMdPath, alreadyExisted };
}
