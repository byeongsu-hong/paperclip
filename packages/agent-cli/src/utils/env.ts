export class EnvError extends Error {}

export type PcEnv = {
  apiUrl: string;
  apiKey: string;
  companyId: string;
  agentId: string;
  runId: string | undefined;
};

export function loadEnv(): PcEnv {
  const apiUrl = process.env.PAPERCLIP_API_URL;
  const apiKey = process.env.PAPERCLIP_API_KEY;
  const companyId = process.env.PAPERCLIP_COMPANY_ID;
  const agentId = process.env.PAPERCLIP_AGENT_ID;

  const missing = [
    !apiUrl && "PAPERCLIP_API_URL",
    !apiKey && "PAPERCLIP_API_KEY",
    !companyId && "PAPERCLIP_COMPANY_ID",
    !agentId && "PAPERCLIP_AGENT_ID",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new EnvError(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    apiUrl: apiUrl!,
    apiKey: apiKey!,
    companyId: companyId!,
    agentId: agentId!,
    runId: process.env.PAPERCLIP_RUN_ID,
  };
}
