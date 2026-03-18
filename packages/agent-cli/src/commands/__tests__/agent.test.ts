import { describe, it, expect, vi } from "vitest";

const mockClient = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
};

describe("agent me", () => {
  it("calls GET /agents/me", async () => {
    mockClient.get.mockResolvedValueOnce({ id: "agent-1", name: "Coder" });
    const result = await mockClient.get("/agents/me");
    expect(result.name).toBe("Coder");
    expect(mockClient.get).toHaveBeenCalledWith("/agents/me");
  });
});
