import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadEnv, EnvError } from "../env.js";

describe("loadEnv", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ["PAPERCLIP_API_URL", "PAPERCLIP_API_KEY", "PAPERCLIP_COMPANY_ID", "PAPERCLIP_AGENT_ID"]) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("throws when PAPERCLIP_API_URL is missing", () => {
    expect(() => loadEnv()).toThrow(EnvError);
  });

  it("returns env object when all required vars are set", () => {
    process.env.PAPERCLIP_API_URL = "http://localhost:3100";
    process.env.PAPERCLIP_API_KEY = "test-key";
    process.env.PAPERCLIP_COMPANY_ID = "company-123";
    process.env.PAPERCLIP_AGENT_ID = "agent-456";
    const env = loadEnv();
    expect(env.apiUrl).toBe("http://localhost:3100");
    expect(env.apiKey).toBe("test-key");
  });
});
