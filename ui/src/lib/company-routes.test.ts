import { describe, expect, it } from "vitest";
import { applyCompanyPrefix, extractCompanyPrefixFromPath } from "./company-routes";

describe("company routes", () => {
  it("does not treat filesystem, terminal, or chat as company prefixes", () => {
    expect(extractCompanyPrefixFromPath("/filesystem")).toBeNull();
    expect(extractCompanyPrefixFromPath("/terminal")).toBeNull();
    expect(extractCompanyPrefixFromPath("/chat")).toBeNull();
  });

  it("applies the active company prefix to board utility routes", () => {
    expect(applyCompanyPrefix("/filesystem", "TES")).toBe("/TES/filesystem");
    expect(applyCompanyPrefix("/terminal", "TES")).toBe("/TES/terminal");
    expect(applyCompanyPrefix("/chat", "TES")).toBe("/TES/chat");
  });
});
