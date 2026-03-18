import { Command } from "commander";
import type { createClient } from "../client.js";
import { output, handleError } from "../utils/output.js";
import type { PcEnv } from "../utils/env.js";

export function buildDashboardCommand(client: ReturnType<typeof createClient>, env: PcEnv) {
  return new Command("dashboard")
    .description("대시보드 조회")
    .option("-C, --company-id <id>")
    .action(async (opts) => {
      const companyId = opts.companyId ?? env.companyId;
      try {
        const data = await client.get<unknown>(`/companies/${companyId}/dashboard`);
        output(data);
      } catch (e) {
        handleError(e);
      }
    });
}
