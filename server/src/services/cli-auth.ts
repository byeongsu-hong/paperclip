import { spawnSync, spawn } from "node:child_process";

export type CliAuthStatus = "authenticated" | "unauthenticated" | "not-installed";

type CliConfig = {
  bin: string;
  args: string[];
};

const CLI_CONFIGS: Record<string, CliConfig> = {
  claude: { bin: "claude", args: ["auth", "status"] },
  gemini: { bin: "gemini", args: ["auth", "print-access-token"] },
  codex: { bin: "codex", args: ["--version"] },
};

export function checkCliAuthStatus(cli: string): CliAuthStatus {
  const config = CLI_CONFIGS[cli];
  if (!config) return "not-installed";

  const result = spawnSync(config.bin, config.args, { timeout: 5000, encoding: "utf8" });

  if (result.error) return "not-installed";
  return result.status === 0 ? "authenticated" : "unauthenticated";
}

export type AllCliStatuses = Record<string, CliAuthStatus>;

export function checkAllCliStatuses(): AllCliStatuses {
  return Object.fromEntries(
    Object.keys(CLI_CONFIGS).map((cli) => [cli, checkCliAuthStatus(cli)])
  );
}

export function checkCliAuthStatusAsync(cli: string): Promise<CliAuthStatus> {
  const config = CLI_CONFIGS[cli];
  if (!config) return Promise.resolve("not-installed" as CliAuthStatus);

  return new Promise((resolve) => {
    const proc = spawn(config.bin, config.args, {
      timeout: 5000,
      stdio: "ignore",
    });
    const timer = setTimeout(() => {
      proc.kill();
      resolve("not-installed");
    }, 5000);
    proc.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? "authenticated" : "unauthenticated");
    });
    proc.on("error", () => {
      clearTimeout(timer);
      resolve("not-installed");
    });
  });
}

export async function checkAllCliStatusesAsync(): Promise<AllCliStatuses> {
  const entries = await Promise.all(
    Object.keys(CLI_CONFIGS).map(async (cli) => [cli, await checkCliAuthStatusAsync(cli)] as const)
  );
  return Object.fromEntries(entries);
}

// CLI별 로그인 명령
export const CLI_AUTH_COMMANDS: Record<string, string[]> = {
  claude: ["claude", "auth", "login"],
  gemini: ["gemini", "auth", "login"],
  codex: ["codex", "login"],
};
