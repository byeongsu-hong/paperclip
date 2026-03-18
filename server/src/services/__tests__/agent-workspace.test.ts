import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { initAgentWorkspace } from "../agent-workspace.js";

describe("initAgentWorkspace", () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-ws-test-"));
    vi.spyOn(os, "homedir").mockReturnValue(tmpHome);
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true });
    vi.restoreAllMocks();
  });

  it("creates workspace directories", () => {
    initAgentWorkspace();
    expect(fs.existsSync(path.join(tmpHome, "workspace"))).toBe(true);
    expect(fs.existsSync(path.join(tmpHome, "workspace", "agents"))).toBe(true);
    expect(fs.existsSync(path.join(tmpHome, "workspace", "docs"))).toBe(true);
  });

  it("creates AGENTS.md in workspace/agents", () => {
    initAgentWorkspace();
    expect(fs.existsSync(path.join(tmpHome, "workspace", "agents", "AGENTS.md"))).toBe(true);
  });

  it("does not overwrite existing AGENTS.md", () => {
    const agentsDir = path.join(tmpHome, "workspace", "agents");
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, "AGENTS.md"), "# existing");
    initAgentWorkspace();
    expect(fs.readFileSync(path.join(agentsDir, "AGENTS.md"), "utf8")).toBe("# existing");
  });

  it("returns correct paths", () => {
    const result = initAgentWorkspace();
    expect(result.workspaceDir).toBe(path.join(tmpHome, "workspace"));
    expect(result.agentsDir).toBe(path.join(tmpHome, "workspace", "agents"));
    expect(result.alreadyExisted).toBe(false);
  });
});
