import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { accessRoutes } from "../routes/access.js";
import { errorHandler } from "../middleware/index.js";

const mockAccessService = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  canUser: vi.fn(),
  isInstanceAdmin: vi.fn(),
  getMembership: vi.fn(),
  ensureMembership: vi.fn(),
  listMembers: vi.fn(),
  setMemberPermissions: vi.fn(),
  promoteInstanceAdmin: vi.fn(),
  demoteInstanceAdmin: vi.fn(),
  listUserCompanyAccess: vi.fn(),
  setUserCompanyAccess: vi.fn(),
  setPrincipalGrants: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  deduplicateAgentName: vi.fn(),
  logActivity: mockLogActivity,
  notifyHireApproved: vi.fn(),
}));

function createDbStub(adminCount: number) {
  const selectResult = Array.from({ length: adminCount }, (_, i) => ({
    id: `role-${i}`,
    userId: `user-${i}`,
    role: "instance_admin",
  }));

  // Chain for db.select().from(...).where(...)
  const whereFn = vi.fn().mockResolvedValue(selectResult);
  const fromFn = vi.fn().mockReturnValue({ where: whereFn });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  // Chain for db.update(...).set(...).where(...)
  const updateWhereFn = vi.fn().mockResolvedValue([]);
  const setFn = vi.fn().mockReturnValue({ where: updateWhereFn });
  const updateFn = vi.fn().mockReturnValue({ set: setFn });

  // Chain for db.insert(...).values(...)
  const valuesFn = vi.fn().mockResolvedValue([]);
  const insertFn = vi.fn().mockReturnValue({ values: valuesFn });

  return {
    select: selectFn,
    update: updateFn,
    insert: insertFn,
  };
}

function createApp(db: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    accessRoutes(db as any, {
      deploymentMode: "authenticated",
      deploymentExposure: "public",
      bindHost: "0.0.0.0",
      allowedHostnames: [],
    }),
  );
  app.use(errorHandler);
  return app;
}

describe("POST /api/auth/bootstrap-web", () => {
  beforeEach(() => {
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("returns 409 when an admin already exists", async () => {
    const db = createDbStub(1);
    const app = createApp(db);

    const res = await request(app).post("/api/auth/bootstrap-web").send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("already has an admin");
  });

  it("returns 200 with inviteUrl when no admin exists", async () => {
    const db = createDbStub(0);
    const app = createApp(db);

    const res = await request(app).post("/api/auth/bootstrap-web").send({});

    expect(res.status).toBe(200);
    expect(res.body.inviteUrl).toMatch(/\/invite\/pcp_bootstrap_/);
  });
});
