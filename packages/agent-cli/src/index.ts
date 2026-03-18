#!/usr/bin/env node
import { Command } from "commander";
import { loadEnv, EnvError } from "./utils/env.js";
import { createClient } from "./client.js";
import { setJsonMode } from "./utils/output.js";
import { buildAgentCommands } from "./commands/agent.js";
import { buildIssueCommands } from "./commands/issue.js";
import { buildApprovalCommands } from "./commands/approval.js";
import { buildDashboardCommand } from "./commands/dashboard.js";
import pc from "picocolors";

const program = new Command();

program
  .name("pc")
  .description("Paperclip agent CLI — heartbeat operations")
  .version("0.1.0")
  .option("--json", "JSON 형식으로 출력");

// lazy wrappers — initialized by preAction hook before any command runs
let env: ReturnType<typeof loadEnv>;
let client: ReturnType<typeof createClient>;

program.hook("preAction", (thisCommand) => {
  const opts = thisCommand.optsWithGlobals();
  setJsonMode(opts.json ?? false);
  try {
    env = loadEnv();
    client = createClient(env);
  } catch (e) {
    if (e instanceof EnvError) {
      console.error(pc.red("Environment error:"), (e as Error).message);
      process.exit(1);
    }
    throw e;
  }
});

const lazyClient = {
  get: (...a: Parameters<ReturnType<typeof createClient>["get"]>) => client.get(...a),
  post: (...a: Parameters<ReturnType<typeof createClient>["post"]>) => client.post(...a),
  patch: (...a: Parameters<ReturnType<typeof createClient>["patch"]>) => client.patch(...a),
  delete: (...a: Parameters<ReturnType<typeof createClient>["delete"]>) => client.delete(...a),
} satisfies ReturnType<typeof createClient>;

const lazyEnv = new Proxy({} as ReturnType<typeof loadEnv>, {
  get: (_target, key) => {
    if (!env) {
      console.error("Error: environment not initialized. Run a command that requires authentication.");
      process.exit(1);
    }
    return (env as any)[key];
  },
});

program.addCommand(buildAgentCommands(lazyClient, lazyEnv));
program.addCommand(buildIssueCommands(lazyClient, lazyEnv));
program.addCommand(buildApprovalCommands(lazyClient));
program.addCommand(buildDashboardCommand(lazyClient, lazyEnv));

program.parse();
