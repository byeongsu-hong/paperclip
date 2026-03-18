import { describe, it, expect } from "vitest";
import { sandboxPath } from "../filesystem.js";
import path from "node:path";
import os from "node:os";

describe("sandboxPath", () => {
  it("allows paths within workspace", () => {
    const workspace = path.join(os.homedir(), "workspace");
    expect(() => sandboxPath(workspace, workspace)).not.toThrow();
    expect(() => sandboxPath(path.join(workspace, "docs"), workspace)).not.toThrow();
  });

  it("rejects path traversal", () => {
    const workspace = path.join(os.homedir(), "workspace");
    expect(() => sandboxPath(path.join(workspace, "../../../etc/passwd"), workspace)).toThrow("Path traversal");
  });
});
