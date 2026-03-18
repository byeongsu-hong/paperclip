import { Command } from "commander";
import type { createClient } from "../client.js";
import { output, handleError } from "../utils/output.js";

export function buildApprovalCommands(client: ReturnType<typeof createClient>) {
  const approval = new Command("approval").description("승인 관련 명령");

  approval
    .command("get <approvalId>")
    .description("승인 상세 조회")
    .action(async (approvalId) => {
      try {
        const data = await client.get<unknown>(`/approvals/${approvalId}`);
        output(data);
      } catch (e) {
        handleError(e);
      }
    });

  return approval;
}
