import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, approvals, companies, goals, issueApprovals, issues, projects } from "@paperclipai/db";
import {
  issueIntakePlanPayloadSchema,
  type CreateIssueIntakeDraft,
  type IssueIntakeDraft,
  type IssueIntakeDraftNode,
  type IssueIntakePlanPayload,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { defaultIssueExecutionWorkspaceSettingsForProject, parseProjectExecutionWorkspacePolicy } from "./execution-workspace-policy.js";
import { getDefaultCompanyGoal } from "./goals.js";
import { resolveIssueGoalId } from "./issue-goal-fallback.js";

type ActorInfo = {
  agentId?: string | null;
  userId?: string | null;
};

type SourceIssue = typeof issues.$inferSelect;
type GoalRow = typeof goals.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;
type AgentRow = typeof agents.$inferSelect;
type ApprovalRow = typeof approvals.$inferSelect;
type JsonRecord = Record<string, unknown>;
type SelectReader = Pick<Db, "select">;
type DraftRecommendationSource = "source" | "override" | "cleared";

type DraftContext = {
  title: string;
  description: string | null;
  projectId: string | null;
  goalId: string | null;
  assigneeAgentId: string | null;
  priority: IssueIntakeDraftNode["priority"];
  status: IssueIntakeDraftNode["status"];
  projectSource: DraftRecommendationSource;
  goalSource: DraftRecommendationSource;
  assigneeSource: DraftRecommendationSource;
};

function cleanTaskTitle(value: string) {
  const normalized = value
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/^\[[ xX]\]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;
  const title = normalized.replace(/[.:;,]\s*$/, "");
  return title.length > 120 ? `${title.slice(0, 117).trimEnd()}...` : title;
}

function excerpt(text: string | null | undefined, max = 180) {
  const normalized = (text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length > max ? `${normalized.slice(0, max - 3).trimEnd()}...` : normalized;
}

function recommendationSource(value: string | null | undefined) {
  if (value === undefined) return "source" satisfies DraftRecommendationSource;
  return value === null ? "cleared" : "override";
}

function recommendationRationale(
  kind: "goal" | "assignee",
  source: DraftRecommendationSource,
  hasValue: boolean,
) {
  if (source === "override" && hasValue) {
    return "Provided as a draft override for review before applying.";
  }
  if (source === "source" && hasValue) {
    return "Inherited from the raw intake issue.";
  }
  if (kind === "goal") {
    return source === "cleared"
      ? "Goal recommendation was intentionally cleared in this draft; reviewer should confirm before applying."
      : "No goal is set on the draft yet; reviewer should confirm before applying.";
  }
  return source === "cleared"
    ? "Assignee recommendation was intentionally cleared in this draft; reviewer should confirm or intentionally defer."
    : "No assignee is set on the draft yet; reviewer should confirm or intentionally defer.";
}

function pickDraftStatus(existingStatus: string, hasAssignee: boolean): IssueIntakeDraftNode["status"] {
  if (existingStatus === "backlog") return "backlog";
  if (existingStatus === "todo") return "todo";
  if (existingStatus === "in_progress") return "todo";
  return hasAssignee ? "todo" : "backlog";
}

function extractChildTaskTitles(description: string | null | undefined, fallbackTitle: string) {
  const lines = (description ?? "")
    .split(/\r?\n/)
    .map((line) => cleanTaskTitle(line))
    .filter((line): line is string => Boolean(line));

  const unique = Array.from(new Set(lines)).slice(0, 5);
  if (unique.length > 0) return unique;
  return [`Clarify scope and decompose ${fallbackTitle}`];
}

function buildDraftNode(input: {
  sourceIssue: SourceIssue;
  title: string;
  description: string | null;
  project: ProjectRow | null;
  projectId?: string | null;
  goal: GoalRow | null;
  goalId?: string | null;
  assignee: AgentRow | null;
  assigneeAgentId?: string | null;
  requestDepth: number;
  priority?: IssueIntakeDraftNode["priority"];
  status?: IssueIntakeDraftNode["status"];
  sourceExcerpt?: string | null;
  goalSource?: DraftRecommendationSource;
  assigneeSource?: DraftRecommendationSource;
}): IssueIntakeDraftNode {
  const projectId = input.projectId === undefined ? input.project?.id ?? input.sourceIssue.projectId ?? null : input.projectId;
  const goalId = input.goalId === undefined ? input.goal?.id ?? input.sourceIssue.goalId ?? null : input.goalId;
  const assigneeId =
    input.assigneeAgentId === undefined
      ? input.assignee?.id ?? input.sourceIssue.assigneeAgentId ?? null
      : input.assigneeAgentId;
  const goalSource = input.goalSource ?? "source";
  const assigneeSource = input.assigneeSource ?? "source";

  return {
    title: input.title,
    description: input.description,
    status:
      input.status ??
      pickDraftStatus(input.sourceIssue.status, Boolean(assigneeId)),
    priority: input.priority ?? input.sourceIssue.priority as IssueIntakeDraftNode["priority"],
    projectId,
    projectLabel: projectId ? (input.project?.name ?? null) : null,
    goal: {
      id: goalId,
      label: goalId ? (input.goal?.title ?? null) : null,
      rationale: recommendationRationale("goal", goalSource, Boolean(goalId)),
    },
    assignee: {
      id: assigneeId,
      label: assigneeId ? (input.assignee?.name ?? null) : null,
      rationale: recommendationRationale("assignee", assigneeSource, Boolean(assigneeId)),
    },
    sourceExcerpt: input.sourceExcerpt ?? excerpt(input.description),
    requestDepth: input.requestDepth,
  };
}

function parseIssueIntakePayload(raw: Record<string, unknown>) {
  const parsed = issueIntakePlanPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    throw unprocessable("Invalid issue intake payload");
  }
  return parsed.data;
}

function buildDraftContext(sourceIssue: SourceIssue, overrides: CreateIssueIntakeDraft = {}): DraftContext {
  const title = overrides.title ?? sourceIssue.title;
  const description = overrides.description === undefined ? sourceIssue.description : overrides.description;
  const projectSource = recommendationSource(overrides.projectId);
  const goalSource = recommendationSource(overrides.goalId);
  const assigneeSource = recommendationSource(overrides.assigneeAgentId);

  return {
    title,
    description,
    projectId: overrides.projectId === undefined ? sourceIssue.projectId : overrides.projectId,
    goalId: overrides.goalId === undefined ? sourceIssue.goalId : overrides.goalId,
    assigneeAgentId:
      overrides.assigneeAgentId === undefined ? sourceIssue.assigneeAgentId : overrides.assigneeAgentId,
    priority:
      overrides.priority ?? sourceIssue.priority as IssueIntakeDraftNode["priority"],
    status:
      overrides.status ?? sourceIssue.status as IssueIntakeDraftNode["status"],
    projectSource,
    goalSource,
    assigneeSource,
  };
}

async function loadIssueContext(
  db: Db,
  companyId: string,
  context: Pick<DraftContext, "projectId" | "goalId" | "assigneeAgentId">,
) {
  const [project, goal, assignee] = await Promise.all([
    context.projectId
      ? db
          .select()
          .from(projects)
          .where(and(eq(projects.companyId, companyId), eq(projects.id, context.projectId)))
          .then((rows) => rows[0] ?? null)
      : null,
    context.goalId
      ? db
          .select()
          .from(goals)
          .where(and(eq(goals.companyId, companyId), eq(goals.id, context.goalId)))
          .then((rows) => rows[0] ?? null)
      : null,
    context.assigneeAgentId
      ? db
          .select()
          .from(agents)
          .where(and(eq(agents.companyId, companyId), eq(agents.id, context.assigneeAgentId)))
          .then((rows) => rows[0] ?? null)
      : null,
  ]);

  return { project, goal, assignee };
}

function buildDraftNotes(input: {
  sourceIssue: SourceIssue;
  context: DraftContext;
  childTitles: string[];
}) {
  const notes = [
    "Generated from the current raw intake issue. Review titles, ownership, and goal alignment before approval.",
  ];
  if (
    input.context.projectSource === "override" ||
    input.context.goalSource === "override" ||
    input.context.assigneeSource === "override"
  ) {
    notes.push("One or more recommendations came from draft-only overrides and will not update the issue until materialization.");
  }
  if (!input.context.goalId) {
    notes.push(
      input.context.goalSource === "cleared"
        ? "Goal recommendation is intentionally deferred in this draft."
        : "Goal recommendation is intentionally deferred because the intake issue is not linked to a goal yet.",
    );
  }
  if (!input.context.assigneeAgentId) {
    notes.push(
      input.context.assigneeSource === "cleared"
        ? "Assignee recommendation is intentionally deferred in this draft."
        : "Assignee recommendation is intentionally deferred because the raw issue is currently unassigned.",
    );
  }
  if (input.childTitles.length === 1 && input.childTitles[0]?.startsWith("Clarify scope")) {
    notes.push("No structured task list was detected in the raw request, so the child task is a conservative clarification step.");
  }
  return notes;
}

async function assertAgentIds(tx: SelectReader, companyId: string, agentIds: string[]) {
  if (agentIds.length === 0) return new Map<string, AgentRow>();
  const rows = await tx
    .select()
    .from(agents)
    .where(and(eq(agents.companyId, companyId), inArray(agents.id, agentIds)));
  if (rows.length !== agentIds.length) {
    throw unprocessable("One or more intake assignees are invalid for this company");
  }
  return new Map(rows.map((row: AgentRow) => [row.id, row]));
}

async function assertGoalIds(tx: SelectReader, companyId: string, goalIds: string[]) {
  if (goalIds.length === 0) return new Map<string, GoalRow>();
  const rows = await tx
    .select()
    .from(goals)
    .where(and(eq(goals.companyId, companyId), inArray(goals.id, goalIds)));
  if (rows.length !== goalIds.length) {
    throw unprocessable("One or more intake goals are invalid for this company");
  }
  return new Map(rows.map((row: GoalRow) => [row.id, row]));
}

async function assertProjectIds(tx: SelectReader, companyId: string, projectIds: string[]) {
  if (projectIds.length === 0) return new Map<string, ProjectRow>();
  const rows = await tx
    .select()
    .from(projects)
    .where(and(eq(projects.companyId, companyId), inArray(projects.id, projectIds)));
  if (rows.length !== projectIds.length) {
    throw unprocessable("One or more intake projects are invalid for this company");
  }
  return new Map(rows.map((row: ProjectRow) => [row.id, row]));
}

function ensureMaterializableNode(node: IssueIntakeDraftNode) {
  if (node.status === "in_progress" && !node.assignee.id) {
    throw unprocessable("in_progress intake nodes require an assignee");
  }
  if (node.status === "done" || node.status === "cancelled") {
    throw unprocessable("Intake materialization does not allow done or cancelled nodes");
  }
}

function nodeExecutionWorkspaceSettings(project: ProjectRow | null) {
  if (!project?.executionWorkspacePolicy) return null;
  return defaultIssueExecutionWorkspaceSettingsForProject(
    parseProjectExecutionWorkspacePolicy(project.executionWorkspacePolicy),
  ) as JsonRecord | null;
}

function buildSourceIssuePatch(input: {
  sourceIssue: SourceIssue;
  node: IssueIntakeDraftNode;
  defaultGoalId: string | null;
  projectMap: Map<string, ProjectRow>;
}) {
  ensureMaterializableNode(input.node);
  const nextProjectId = input.node.projectId ?? null;
  const nextGoalId = resolveIssueGoalId({
    projectId: nextProjectId,
    goalId: input.node.goal.id,
    defaultGoalId: input.defaultGoalId,
  });
  const now = new Date();
  const assigneeAgentId = input.node.assignee.id ?? null;
  const status = input.node.status;
  const patch: Partial<typeof issues.$inferInsert> = {
    title: input.node.title,
    description: input.node.description,
    projectId: nextProjectId,
    goalId: nextGoalId,
    status,
    priority: input.node.priority,
    assigneeAgentId,
    assigneeUserId: null,
    requestDepth: input.node.requestDepth,
    executionWorkspaceSettings: nodeExecutionWorkspaceSettings(
      nextProjectId ? (input.projectMap.get(nextProjectId) ?? null) : null,
    ),
    updatedAt: now,
  };

  if (status === "in_progress" && !input.sourceIssue.startedAt) {
    patch.startedAt = now;
  }
  if (status !== "in_progress") {
    patch.checkoutRunId = null;
  }
  if (status === "done") {
    patch.completedAt = now;
  } else {
    patch.completedAt = null;
  }
  if (status === "cancelled") {
    patch.cancelledAt = now;
  } else {
    patch.cancelledAt = null;
  }

  return patch;
}

function buildChildIssueInsert(input: {
  companyId: string;
  parentId: string;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  node: IssueIntakeDraftNode;
  issueNumber: number;
  issuePrefix: string;
  defaultGoalId: string | null;
  projectMap: Map<string, ProjectRow>;
}) {
  ensureMaterializableNode(input.node);
  const projectId = input.node.projectId ?? null;
  const goalId = resolveIssueGoalId({
    projectId,
    goalId: input.node.goal.id,
    defaultGoalId: input.defaultGoalId,
  });
  const now = new Date();

  return {
    companyId: input.companyId,
    projectId,
    goalId,
    parentId: input.parentId,
    title: input.node.title,
    description: input.node.description,
    status: input.node.status,
    priority: input.node.priority,
    assigneeAgentId: input.node.assignee.id ?? null,
    assigneeUserId: null,
    createdByAgentId: input.createdByAgentId,
    createdByUserId: input.createdByUserId,
    issueNumber: input.issueNumber,
    identifier: `${input.issuePrefix}-${input.issueNumber}`,
    requestDepth: input.node.requestDepth,
    executionWorkspaceSettings: nodeExecutionWorkspaceSettings(
      projectId ? (input.projectMap.get(projectId) ?? null) : null,
    ),
    startedAt: input.node.status === "in_progress" ? now : null,
    completedAt: null,
    cancelledAt: null,
    updatedAt: now,
  } satisfies typeof issues.$inferInsert;
}

export async function buildIssueIntakePlanPayload(
  db: Db,
  sourceIssueId: string,
  overrides: CreateIssueIntakeDraft = {},
): Promise<IssueIntakePlanPayload> {
  const sourceIssue = await db
    .select()
    .from(issues)
    .where(eq(issues.id, sourceIssueId))
    .then((rows) => rows[0] ?? null);

  if (!sourceIssue) {
    throw notFound("Issue not found");
  }

  const context = buildDraftContext(sourceIssue, overrides);
  const { project, goal, assignee } = await loadIssueContext(db, sourceIssue.companyId, context);
  const childTitles = extractChildTaskTitles(context.description, context.title);
  const notes = buildDraftNotes({ sourceIssue, context, childTitles });
  const parent = buildDraftNode({
    sourceIssue,
    title: context.title,
    description: context.description,
    project,
    projectId: context.projectId,
    goal,
    goalId: context.goalId,
    assignee,
    assigneeAgentId: context.assigneeAgentId,
    requestDepth: sourceIssue.requestDepth,
    priority: context.priority,
    status: context.status,
    sourceExcerpt: excerpt(context.description),
    goalSource: context.goalSource,
    assigneeSource: context.assigneeSource,
  });
  const children = childTitles.map((title) =>
    buildDraftNode({
      sourceIssue,
      title,
      description: null,
      project,
      projectId: context.projectId,
      goal,
      goalId: context.goalId,
      assignee,
      assigneeAgentId: context.assigneeAgentId,
      requestDepth: sourceIssue.requestDepth + 1,
      priority: context.priority,
      status: assignee ? "todo" : "backlog",
      sourceExcerpt: excerpt(title, 120),
      goalSource: context.goalSource,
      assigneeSource: context.assigneeSource,
    })
  );

  return issueIntakePlanPayloadSchema.parse({
    version: 1,
    sourceIssueId: sourceIssue.id,
    rawRequest: {
      title: context.title,
      description: context.description,
    },
    proposal: {
      parent,
      children,
      notes,
    } satisfies IssueIntakeDraft,
    materialization: null,
  });
}

export async function materializeIssueIntakePlan(
  db: Db,
  approvalId: string,
  actor: ActorInfo,
) {
  return db.transaction(async (tx) => {
    const approval = await tx
      .select()
      .from(approvals)
      .where(eq(approvals.id, approvalId))
      .then((rows) => rows[0] ?? null);
    if (!approval) throw notFound("Approval not found");
    if (approval.type !== "issue_intake_plan") {
      throw unprocessable("Approval is not an intake plan");
    }
    if (approval.status !== "approved") {
      throw conflict("Only approved intake plans can be materialized");
    }

    const payload = parseIssueIntakePayload(approval.payload);
    if (payload.materialization?.createdIssueIds?.length) {
      const linkedIssues = await tx
        .select()
        .from(issues)
        .where(inArray(issues.id, payload.materialization.createdIssueIds));
      return { approval, issues: linkedIssues, applied: false };
    }
    if (payload.proposal.children.length === 0 || payload.proposal.children.length > 5) {
      throw unprocessable("Intake plans must materialize between 1 and 5 child issues");
    }

    const sourceIssue = await tx
      .select()
      .from(issues)
      .where(eq(issues.id, payload.sourceIssueId))
      .then((rows) => rows[0] ?? null);
    if (!sourceIssue) throw notFound("Source issue not found");
    if (sourceIssue.companyId !== approval.companyId) {
      throw unprocessable("Source issue and approval must belong to the same company");
    }

    const allNodes = [payload.proposal.parent, ...payload.proposal.children];
    const uniqueAgentIds = Array.from(
      new Set(allNodes.map((node) => node.assignee.id).filter((value): value is string => Boolean(value))),
    );
    const uniqueGoalIds = Array.from(
      new Set(allNodes.map((node) => node.goal.id).filter((value): value is string => Boolean(value))),
    );
    const uniqueProjectIds = Array.from(
      new Set(allNodes.map((node) => node.projectId).filter((value): value is string => Boolean(value))),
    );

    await Promise.all([
      assertAgentIds(tx, approval.companyId, uniqueAgentIds),
      assertGoalIds(tx, approval.companyId, uniqueGoalIds),
    ]);
    const projectMap = await assertProjectIds(tx, approval.companyId, uniqueProjectIds);
    const defaultGoal = await getDefaultCompanyGoal(tx, approval.companyId);
    const defaultGoalId = defaultGoal?.id ?? null;

    const sourcePatch = buildSourceIssuePatch({
      sourceIssue,
      node: payload.proposal.parent,
      defaultGoalId,
      projectMap,
    });
    const [updatedSourceIssue] = await tx
      .update(issues)
      .set(sourcePatch)
      .where(eq(issues.id, sourceIssue.id))
      .returning();

    const childCount = payload.proposal.children.length;
    const issueCounterUpdate = await tx
      .update(companies)
      .set({ issueCounter: sql`${companies.issueCounter} + ${childCount}` })
      .where(eq(companies.id, approval.companyId))
      .returning({ issueCounter: companies.issueCounter, issuePrefix: companies.issuePrefix })
      .then((rows) => rows[0] ?? null);

    if (!issueCounterUpdate) {
      throw notFound("Company not found");
    }

    const firstIssueNumber = issueCounterUpdate.issueCounter - childCount + 1;
    const childIssueValues = payload.proposal.children.map((node, index) =>
      buildChildIssueInsert({
        companyId: approval.companyId,
        parentId: updatedSourceIssue.id,
        createdByAgentId: actor.agentId ?? null,
        createdByUserId: actor.userId ?? null,
        node,
        issueNumber: firstIssueNumber + index,
        issuePrefix: issueCounterUpdate.issuePrefix,
        defaultGoalId,
        projectMap,
      })
    );

    const createdChildIssues = childIssueValues.length > 0
      ? await tx.insert(issues).values(childIssueValues).returning()
      : [];

    const linkedIssueIds = [updatedSourceIssue.id, ...createdChildIssues.map((issue) => issue.id)];
    await tx
      .insert(issueApprovals)
      .values(
        linkedIssueIds.map((issueId) => ({
          companyId: approval.companyId,
          issueId,
          approvalId: approval.id,
          linkedByAgentId: actor.agentId ?? null,
          linkedByUserId: actor.userId ?? null,
        })),
      )
      .onConflictDoNothing();

    const nowIso = new Date().toISOString();
    const nextPayload = issueIntakePlanPayloadSchema.parse({
      ...payload,
      materialization: {
        appliedAt: nowIso,
        sourceIssueId: updatedSourceIssue.id,
        createdIssueIds: linkedIssueIds,
      },
    });

    const [updatedApproval] = await tx
      .update(approvals)
      .set({
        payload: nextPayload,
        updatedAt: new Date(),
      })
      .where(eq(approvals.id, approval.id))
      .returning();

    return {
      approval: updatedApproval,
      issues: [updatedSourceIssue, ...createdChildIssues],
      applied: true,
    };
  });
}
