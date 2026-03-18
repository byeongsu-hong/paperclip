import { describe, it, expect, vi } from "vitest";
import { checkCliAuthStatus } from "../cli-auth.js";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

import { spawnSync } from "node:child_process";

describe("checkCliAuthStatus", () => {
  it("returns not-installed when CLI binary not found", () => {
    vi.mocked(spawnSync).mockReturnValue({ status: null, error: new Error("ENOENT") } as any);
    const status = checkCliAuthStatus("claude");
    expect(status).toBe("not-installed");
  });

  it("returns authenticated when status command exits 0", () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 0, error: undefined } as any);
    const status = checkCliAuthStatus("claude");
    expect(status).toBe("authenticated");
  });

  it("returns unauthenticated when status command exits non-zero", () => {
    vi.mocked(spawnSync).mockReturnValue({ status: 1, error: undefined } as any);
    const status = checkCliAuthStatus("claude");
    expect(status).toBe("unauthenticated");
  });
});
