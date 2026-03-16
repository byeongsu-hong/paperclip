import { approvals, companies, issueApprovals, issues } from "@paperclipai/db";
import { describe, expect, it } from "vitest";
import type { IssueIntakePlanPayload } from "@paperclipai/shared";
import { buildIssueIntakePlanPayload, materializeIssueIntakePlan } from "../services/issue-intake.ts";

const ids = {
  issue: "00000000-0000-4000-8000-000000000001",
  company: "00000000-0000-4000-8000-000000000002",
  projectSource: "00000000-0000-4000-8000-000000000003",
  goalSource: "00000000-0000-4000-8000-000000000004",
  agentSource: "00000000-0000-4000-8000-000000000005",
  projectOverride: "00000000-0000-4000-8000-000000000006",
  goalOverride: "00000000-0000-4000-8000-000000000007",
  agentOverride: "00000000-0000-4000-8000-000000000008",
  childOne: "00000000-0000-4000-8000-000000000009",
  childTwo: "00000000-0000-4000-8000-000000000010",
} as const;

function createDbStub(selectResults: unknown[][]) {
  const pendingResults = [...selectResults];
  const where = async () => pendingResults.shift() ?? [];
  const from = () => ({ where });
  const select = () => ({ from });
  return { select };
}

function createMaterializationDbStub(input: {
  approval: Record<string, unknown>;
  sourceIssue: Record<string, unknown>;
  issueCounter: number;
  issuePrefix: string;
}) {
  const selectResults = [[input.approval], [input.sourceIssue], [], [], []];
  const updateCalls: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const insertCalls: Array<{ table: unknown; values: unknown }> = [];

  const select = () => {
    const result = selectResults.shift() ?? [];
    const query = {
      from: () => query,
      where: () => query,
      orderBy: () => query,
      then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(resolve(result)),
    };
    return query;
  };

  const update = (table: unknown) => ({
    set: (values: Record<string, unknown>) => {
      updateCalls.push({ table, values });
      return {
        where: () => ({
          returning: async () => {
            if (table === issues) {
              return [{ ...input.sourceIssue, ...values }];
            }
            if (table === companies) {
              return [{ issueCounter: input.issueCounter, issuePrefix: input.issuePrefix }];
            }
            if (table === approvals) {
              return [{ ...input.approval, ...values }];
            }
            return [];
          },
        }),
      };
    },
  });

  const insert = (table: unknown) => ({
    values: (values: unknown) => {
      insertCalls.push({ table, values });
      if (table === issues) {
        const childValues = values as Array<Record<string, unknown>>;
        return {
          returning: async () =>
            childValues.map((child, index) => ({
              id: index === 0 ? ids.childOne : ids.childTwo,
              ...child,
            })),
        };
      }
      return {
        onConflictDoNothing: async () => ({ rowCount: 0 }),
      };
    },
  });

  return {
    db: {
      transaction: async (fn: (tx: { select: typeof select; update: typeof update; insert: typeof insert }) => unknown) =>
        fn({ select, update, insert }),
    },
    updateCalls,
    insertCalls,
  };
}

function createSourceIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.issue,
    companyId: ids.company,
    projectId: ids.projectSource,
    goalId: ids.goalSource,
    parentId: null,
    title: "Raw intake",
    description: "- Ship parser\n- Add tests",
    status: "in_progress",
    priority: "low",
    assigneeAgentId: ids.agentSource,
    assigneeUserId: null,
    checkoutRunId: null,
    executionRunId: null,
    executionAgentNameKey: null,
    executionLockedAt: null,
    createdByAgentId: null,
    createdByUserId: "user-1",
    issueNumber: 17,
    identifier: "MIT-17",
    requestDepth: 0,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionWorkspaceSettings: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    createdAt: new Date("2026-03-14T00:00:00.000Z"),
    updatedAt: new Date("2026-03-14T00:00:00.000Z"),
    ...overrides,
  };
}

describe("buildIssueIntakePlanPayload", () => {
  it("honors draft overrides without mutating the source issue context", async () => {
    const db = createDbStub([[createSourceIssue()]]);

    const payload = await buildIssueIntakePlanPayload(db as any, ids.issue, {
      title: "Normalized parent",
      description: "- Draft scope\n- Review rollout",
      projectId: null,
      goalId: null,
      assigneeAgentId: null,
      priority: "high",
      status: "todo",
    });

    expect(payload.rawRequest).toEqual({
      title: "Normalized parent",
      description: "- Draft scope\n- Review rollout",
    });
    expect(payload.proposal.parent.title).toBe("Normalized parent");
    expect(payload.proposal.parent.status).toBe("todo");
    expect(payload.proposal.parent.priority).toBe("high");
    expect(payload.proposal.parent.projectId).toBeNull();
    expect(payload.proposal.parent.goal.id).toBeNull();
    expect(payload.proposal.parent.goal.rationale).toContain("intentionally cleared");
    expect(payload.proposal.parent.assignee.id).toBeNull();
    expect(payload.proposal.parent.assignee.rationale).toContain("intentionally cleared");
    expect(payload.proposal.children.map((child) => child.title)).toEqual([
      "Draft scope",
      "Review rollout",
    ]);
    expect(payload.proposal.children.every((child) => child.status === "backlog")).toBe(true);
    expect(payload.proposal.children.every((child) => child.priority === "high")).toBe(true);
  });

  it("hydrates override recommendations with company entities", async () => {
    const db = createDbStub([
      [createSourceIssue({ projectId: null, goalId: null, assigneeAgentId: null, status: "backlog" })],
      [{ id: ids.projectOverride, companyId: ids.company, name: "Planner", executionWorkspacePolicy: null }],
      [{ id: ids.goalOverride, companyId: ids.company, title: "Automate intake" }],
      [{ id: ids.agentOverride, companyId: ids.company, name: "Codex Builder" }],
    ]);

    const payload = await buildIssueIntakePlanPayload(db as any, ids.issue, {
      projectId: ids.projectOverride,
      goalId: ids.goalOverride,
      assigneeAgentId: ids.agentOverride,
    });

    expect(payload.proposal.parent.projectId).toBe(ids.projectOverride);
    expect(payload.proposal.parent.projectLabel).toBe("Planner");
    expect(payload.proposal.parent.goal).toMatchObject({
      id: ids.goalOverride,
      label: "Automate intake",
    });
    expect(payload.proposal.parent.goal.rationale).toContain("draft override");
    expect(payload.proposal.parent.assignee).toMatchObject({
      id: ids.agentOverride,
      label: "Codex Builder",
    });
    expect(payload.proposal.parent.assignee.rationale).toContain("draft override");
    expect(payload.proposal.children.every((child) => child.status === "todo")).toBe(true);
    expect(payload.proposal.notes.some((note) => note.includes("draft-only overrides"))).toBe(true);
  });
});

describe("materializeIssueIntakePlan", () => {
  it("updates the source issue, creates child issues, and records materialization metadata", async () => {
    const payload: IssueIntakePlanPayload = {
      version: 1,
      sourceIssueId: ids.issue,
      rawRequest: {
        title: "Raw intake",
        description: "Ship parser and add tests",
      },
      proposal: {
        parent: {
          title: "Normalized parent",
          description: "Reviewed parent scope",
          status: "todo",
          priority: "high",
          projectId: null,
          projectLabel: null,
          goal: { id: null, label: null, rationale: "Deferred for review." },
          assignee: { id: null, label: null, rationale: "Deferred for review." },
          sourceExcerpt: "Ship parser and add tests",
          requestDepth: 0,
        },
        children: [
          {
            title: "Ship parser",
            description: null,
            status: "backlog",
            priority: "high",
            projectId: null,
            projectLabel: null,
            goal: { id: null, label: null, rationale: "Deferred for review." },
            assignee: { id: null, label: null, rationale: "Deferred for review." },
            sourceExcerpt: "Ship parser",
            requestDepth: 1,
          },
          {
            title: "Add tests",
            description: null,
            status: "backlog",
            priority: "high",
            projectId: null,
            projectLabel: null,
            goal: { id: null, label: null, rationale: "Deferred for review." },
            assignee: { id: null, label: null, rationale: "Deferred for review." },
            sourceExcerpt: "Add tests",
            requestDepth: 1,
          },
        ],
        notes: ["Generated for review."],
      },
      materialization: null,
    };

    const sourceIssue = createSourceIssue({
      status: "in_progress",
      checkoutRunId: "run-1",
      executionRunId: "run-1",
      executionLockedAt: new Date("2026-03-14T00:01:00.000Z"),
    });
    const approval = {
      id: "approval-1",
      companyId: ids.company,
      type: "issue_intake_plan",
      status: "approved",
      payload,
      requestedByAgentId: null,
      requestedByUserId: "user-1",
      decisionNote: null,
      decidedByUserId: "user-1",
      decidedAt: new Date("2026-03-14T00:02:00.000Z"),
      createdAt: new Date("2026-03-14T00:00:00.000Z"),
      updatedAt: new Date("2026-03-14T00:02:00.000Z"),
    };
    const dbStub = createMaterializationDbStub({
      approval,
      sourceIssue,
      issueCounter: 19,
      issuePrefix: "MIT",
    });

    const result = await materializeIssueIntakePlan(dbStub.db as any, "approval-1", {
      userId: "user-1",
    });

    expect(result.applied).toBe(true);
    expect(result.issues.map((issue) => issue.id)).toEqual([ids.issue, ids.childOne, ids.childTwo]);
    expect(result.issues[0]).toMatchObject({
      id: ids.issue,
      title: "Normalized parent",
      status: "todo",
      checkoutRunId: null,
    });
    expect(result.issues[1]).toMatchObject({
      id: ids.childOne,
      parentId: ids.issue,
      identifier: "MIT-18",
      title: "Ship parser",
    });
    expect(result.issues[2]).toMatchObject({
      id: ids.childTwo,
      parentId: ids.issue,
      identifier: "MIT-19",
      title: "Add tests",
    });

    const sourcePatch = dbStub.updateCalls.find((call) => call.table === issues)?.values;
    expect(sourcePatch).toMatchObject({
      title: "Normalized parent",
      status: "todo",
      checkoutRunId: null,
      completedAt: null,
      cancelledAt: null,
    });

    const approvalUpdate = dbStub.updateCalls.find((call) => call.table === approvals)?.values;
    const materialization = (approvalUpdate?.payload as IssueIntakePlanPayload).materialization;
    expect(materialization?.sourceIssueId).toBe(ids.issue);
    expect(materialization?.createdIssueIds).toEqual([ids.issue, ids.childOne, ids.childTwo]);

    expect(
      dbStub.insertCalls.find((call) => call.table === issueApprovals)?.values,
    ).toHaveLength(3);
  });
});
