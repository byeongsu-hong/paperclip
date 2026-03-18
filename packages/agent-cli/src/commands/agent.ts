import { Command } from "commander";
import type { createClient } from "../client.js";
import { output, handleError } from "../utils/output.js";
import type { PcEnv } from "../utils/env.js";

type Client = ReturnType<typeof createClient>;

export function buildAgentCommands(client: Client, env: PcEnv) {
  const agent = new Command("agent").description("에이전트 관련 명령");

  // pc agent get me  (SKILL.md compatible)
  const agentGet = new Command("get").description("에이전트 정보 조회");
  agentGet
    .command("me")
    .description("내 에이전트 정보 조회")
    .action(async () => {
      try {
        const data = await client.get<unknown>("/agents/me");
        output(data);
      } catch (e) {
        handleError(e);
      }
    });
  agent.addCommand(agentGet);

  // pc agent me (alias)
  agent
    .command("me")
    .description("내 에이전트 정보 조회 (alias: agent get me)")
    .action(async () => {
      try {
        const data = await client.get<unknown>("/agents/me");
        output(data);
      } catch (e) {
        handleError(e);
      }
    });

  // pc agent list
  agent
    .command("list")
    .description("에이전트 목록 조회")
    .option("-C, --company-id <id>", "회사 ID (기본: PAPERCLIP_COMPANY_ID)")
    .action(async (opts) => {
      const companyId = opts.companyId ?? env.companyId;
      try {
        const data = await client.get<{ agents: any[] }>(`/companies/${companyId}/agents`);
        output(data.agents, (d) =>
          (d as any[]).map((a) => ({ id: a.id, name: a.name, role: a.role, status: a.status }))
        );
      } catch (e) {
        handleError(e);
      }
    });

  // pc agent wake <ref>
  agent
    .command("wake <agentRef>")
    .description("에이전트 깨우기")
    .requiredOption("--message <msg>", "Wake 메시지")
    .action(async (agentRef, opts) => {
      try {
        const data = await client.post<unknown>(`/agents/${agentRef}/wake`, { message: opts.message });
        output(data);
      } catch (e) {
        handleError(e);
      }
    });

  // pc agent inbox
  agent
    .command("inbox")
    .description("내 할당 이슈 목록 (compact inbox-lite)")
    .action(async () => {
      try {
        const data = await client.get<{ issues: any[] }>("/agents/me/inbox-lite");
        output(data.issues ?? data, (d) =>
          (d as any[]).map((i) => ({ id: i.identifier ?? i.id, title: i.title, status: i.status, priority: i.priority }))
        );
      } catch (e) {
        handleError(e);
      }
    });

  return agent;
}
