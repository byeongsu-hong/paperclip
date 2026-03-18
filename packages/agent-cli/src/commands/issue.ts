import { Command } from "commander";
import type { createClient } from "../client.js";
import { output, handleError } from "../utils/output.js";
import type { PcEnv } from "../utils/env.js";

type Client = ReturnType<typeof createClient>;

export function buildIssueCommands(client: Client, env: PcEnv) {
  const issue = new Command("issue").description("이슈 관련 명령");

  issue
    .command("list")
    .description("이슈 목록 조회")
    .option("-C, --company-id <id>")
    .option("--assignee-agent-id <id>", "담당 에이전트 ID (me: 자신)")
    .option("--status <statuses>", "상태 필터 (쉼표 구분)")
    .option("-q, --query <q>", "검색어")
    .action(async (opts) => {
      const companyId = opts.companyId ?? env.companyId;
      const params = new URLSearchParams();
      const assigneeId = opts.assigneeAgentId === "me" ? env.agentId : opts.assigneeAgentId;
      if (assigneeId) params.set("assigneeAgentId", assigneeId);
      if (opts.status) params.set("status", opts.status);
      if (opts.query) params.set("q", opts.query);
      try {
        const data = await client.get<{ issues: any[] }>(`/companies/${companyId}/issues?${params}`);
        output(data.issues, (d) =>
          (d as any[]).map((i) => ({
            id: i.identifier ?? i.id,
            title: i.title,
            status: i.status,
            assignee: i.assigneeAgent?.name ?? "-",
          }))
        );
      } catch (e) {
        handleError(e);
      }
    });

  issue
    .command("get <issueId>")
    .description("이슈 상세 조회")
    .action(async (issueId) => {
      try {
        const data = await client.get<unknown>(`/issues/${issueId}`);
        output(data);
      } catch (e) {
        handleError(e);
      }
    });

  issue
    .command("checkout <issueId>")
    .description("이슈 체크아웃 (작업 시작)")
    .action(async (issueId) => {
      try {
        const data = await client.post<unknown>(`/issues/${issueId}/checkout`, {
          agentId: env.agentId,
        });
        output(data);
      } catch (e) {
        handleError(e);
      }
    });

  issue
    .command("update <issueId>")
    .description("이슈 상태/필드 업데이트")
    .option("--status <status>", "새 상태")
    .option("--comment <text>", "코멘트 추가")
    .option("--title <title>")
    .option("--priority <priority>")
    .option("--assignee-agent-id <id>")
    .option("--project-id <id>")
    .option("--goal-id <id>")
    .option("--parent-id <id>")
    .option("--description <desc>")
    .option("--billing-code <code>")
    .action(async (issueId, opts) => {
      const body: Record<string, unknown> = {};
      if (opts.status) body.status = opts.status;
      if (opts.comment) body.comment = opts.comment;
      if (opts.title) body.title = opts.title;
      if (opts.priority) body.priority = opts.priority;
      if (opts.assigneeAgentId !== undefined) body.assigneeAgentId = opts.assigneeAgentId || null;
      if (opts.projectId) body.projectId = opts.projectId;
      if (opts.goalId) body.goalId = opts.goalId;
      if (opts.parentId) body.parentId = opts.parentId;
      if (opts.description) body.description = opts.description;
      if (opts.billingCode) body.billingCode = opts.billingCode;

      if (Object.keys(body).length === 0) {
        console.error("Error: at least one option required (--status, --title, --comment, etc.)");
        process.exit(1);
      }

      try {
        const data = await client.patch<unknown>(`/issues/${issueId}`, body);
        output(data);
      } catch (e) {
        handleError(e);
      }
    });

  issue
    .command("comment <issueId>")
    .description("코멘트 추가")
    .requiredOption("--body <text>", "코멘트 내용")
    .action(async (issueId, opts) => {
      try {
        const data = await client.post<unknown>(`/issues/${issueId}/comments`, { body: opts.body });
        output(data);
      } catch (e) {
        handleError(e);
      }
    });

  issue
    .command("create")
    .description("이슈 생성")
    .option("-C, --company-id <id>")
    .requiredOption("--title <title>")
    .option("--description <desc>")
    .option("--status <status>", "기본: todo")
    .option("--priority <priority>")
    .option("--assignee-agent-id <id>")
    .option("--parent-id <id>")
    .option("--goal-id <id>")
    .option("--project-id <id>")
    .option("--billing-code <code>")
    .action(async (opts) => {
      const companyId = opts.companyId ?? env.companyId;
      const body: Record<string, unknown> = {
        title: opts.title,
        status: opts.status ?? "todo",
      };
      if (opts.description) body.description = opts.description;
      if (opts.priority) body.priority = opts.priority;
      if (opts.assigneeAgentId) body.assigneeAgentId = opts.assigneeAgentId;
      if (opts.parentId) body.parentId = opts.parentId;
      if (opts.goalId) body.goalId = opts.goalId;
      if (opts.projectId) body.projectId = opts.projectId;
      if (opts.billingCode) body.billingCode = opts.billingCode;
      try {
        const data = await client.post<unknown>(`/companies/${companyId}/issues`, body);
        output(data);
      } catch (e) {
        handleError(e);
      }
    });

  issue
    .command("release <issueId>")
    .description("이슈 체크아웃 해제")
    .action(async (issueId) => {
      try {
        const data = await client.post<unknown>(`/issues/${issueId}/release`);
        output(data);
      } catch (e) {
        handleError(e);
      }
    });

  issue
    .command("search <query>")
    .description("이슈 검색")
    .option("-C, --company-id <id>")
    .action(async (query, opts) => {
      const companyId = opts.companyId ?? env.companyId;
      try {
        const data = await client.get<{ issues: any[] }>(
          `/companies/${companyId}/issues?q=${encodeURIComponent(query)}`
        );
        output(data.issues, (d) =>
          (d as any[]).map((i) => ({ id: i.identifier ?? i.id, title: i.title, status: i.status }))
        );
      } catch (e) {
        handleError(e);
      }
    });

  issue
    .command("stalled")
    .description("정체된 이슈 조회")
    .option("-C, --company-id <id>")
    .option("--threshold <minutes>", "기준 시간(분)", "60")
    .action(async (opts) => {
      const companyId = opts.companyId ?? env.companyId;
      try {
        const data = await client.get<{ issues: any[] }>(
          `/companies/${companyId}/issues/stalled?threshold=${encodeURIComponent(opts.threshold)}`
        );
        output(data.issues ?? data);
      } catch (e) {
        handleError(e);
      }
    });

  return issue;
}
