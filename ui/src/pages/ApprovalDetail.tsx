import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approvalsApi } from "../api/approvals";
import { agentsApi } from "../api/agents";
import { goalsApi } from "../api/goals";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { StatusBadge } from "../components/StatusBadge";
import { Identity } from "../components/Identity";
import { typeLabel, typeIcon, defaultTypeIcon, ApprovalPayloadRenderer } from "../components/ApprovalPayload";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import {
  ISSUE_PRIORITIES,
  issueIntakePlanPayloadSchema,
  type ApprovalComment,
  type Goal,
  type IssueIntakeDraftNode,
  type IssueIntakePlanPayload,
  type Project,
} from "@paperclipai/shared";
import { MarkdownBody } from "../components/MarkdownBody";

const NONE_VALUE = "__none__";
const INTAKE_STATUS_OPTIONS = ["backlog", "todo", "in_progress", "in_review", "blocked"] as const;

type IntakeSelectOption = {
  value: string;
  label: string;
};

function cloneIntakePayload(payload: IssueIntakePlanPayload) {
  return issueIntakePlanPayloadSchema.parse(JSON.parse(JSON.stringify(payload)));
}

function recommendationRationale(kind: "goal" | "assignee", label: string | null) {
  if (!label) {
    return kind === "goal"
      ? "Reviewer intentionally deferred goal selection during intake review."
      : "Reviewer intentionally deferred assignee selection during intake review.";
  }
  return kind === "goal"
    ? `Reviewed and aligned to ${label}.`
    : `Reviewed and assigned to ${label}.`;
}

function makeChildDraft(parent: IssueIntakeDraftNode, index: number): IssueIntakeDraftNode {
  return {
    ...parent,
    title: `Follow-up task ${index + 1}`,
    description: null,
    status: parent.assignee.id ? "todo" : "backlog",
    sourceExcerpt: null,
    requestDepth: parent.requestDepth + 1,
  };
}

function IntakeNodeEditor({
  label,
  node,
  editable,
  agentOptions,
  goalOptions,
  projectOptions,
  onChange,
  actions,
}: {
  label: string;
  node: IssueIntakeDraftNode;
  editable: boolean;
  agentOptions: IntakeSelectOption[];
  goalOptions: IntakeSelectOption[];
  projectOptions: IntakeSelectOption[];
  onChange: (next: IssueIntakeDraftNode) => void;
  actions?: ReactNode;
}) {
  const updateProject = (projectId: string) => {
    const option = projectOptions.find((entry) => entry.value === projectId) ?? null;
    onChange({
      ...node,
      projectId: projectId === NONE_VALUE ? null : projectId,
      projectLabel: projectId === NONE_VALUE ? null : option?.label ?? null,
    });
  };

  const updateGoal = (goalId: string) => {
    const option = goalOptions.find((entry) => entry.value === goalId) ?? null;
    const nextId = goalId === NONE_VALUE ? null : goalId;
    const nextLabel = goalId === NONE_VALUE ? null : option?.label ?? null;
    onChange({
      ...node,
      goal: {
        id: nextId,
        label: nextLabel,
        rationale: recommendationRationale("goal", nextLabel),
      },
    });
  };

  const updateAssignee = (assigneeId: string) => {
    const option = agentOptions.find((entry) => entry.value === assigneeId) ?? null;
    const nextId = assigneeId === NONE_VALUE ? null : assigneeId;
    const nextLabel = assigneeId === NONE_VALUE ? null : option?.label ?? null;
    onChange({
      ...node,
      assignee: {
        id: nextId,
        label: nextLabel,
        rationale: recommendationRationale("assignee", nextLabel),
      },
    });
  };

  return (
    <div className="rounded-lg border border-border/70 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">{label}</h4>
          <p className="text-xs text-muted-foreground">
            Request depth {node.requestDepth}
            {node.sourceExcerpt ? ` · ${node.sourceExcerpt}` : ""}
          </p>
        </div>
        {actions}
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Title</Label>
          <Input
            value={node.title}
            onChange={(event) => onChange({ ...node, title: event.target.value })}
            disabled={!editable}
          />
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Description</Label>
          <Textarea
            value={node.description ?? ""}
            onChange={(event) =>
              onChange({
                ...node,
                description: event.target.value.trim() ? event.target.value : null,
              })
            }
            rows={3}
            disabled={!editable}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <Select
              value={node.priority}
              onValueChange={(priority) => onChange({ ...node, priority: priority as typeof node.priority })}
              disabled={!editable}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={node.status}
              onValueChange={(status) => onChange({ ...node, status: status as typeof node.status })}
              disabled={!editable}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTAKE_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Project</Label>
            <Select
              value={node.projectId ?? NONE_VALUE}
              onValueChange={updateProject}
              disabled={!editable}
            >
              <SelectTrigger>
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>No project</SelectItem>
                {projectOptions.map((project) => (
                  <SelectItem key={project.value} value={project.value}>
                    {project.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Goal</Label>
            <Select
              value={node.goal.id ?? NONE_VALUE}
              onValueChange={updateGoal}
              disabled={!editable}
            >
              <SelectTrigger>
                <SelectValue placeholder="No goal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>No goal</SelectItem>
                {goalOptions.map((goal) => (
                  <SelectItem key={goal.value} value={goal.value}>
                    {goal.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Assignee</Label>
          <Select
            value={node.assignee.id ?? NONE_VALUE}
            onValueChange={updateAssignee}
            disabled={!editable}
          >
            <SelectTrigger>
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Unassigned</SelectItem>
              {agentOptions.map((agent) => (
                <SelectItem key={agent.value} value={agent.value}>
                  {agent.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">{node.assignee.rationale}</p>
        </div>

        <p className="text-[11px] text-muted-foreground">{node.goal.rationale}</p>
      </div>
    </div>
  );
}

export function ApprovalDetail() {
  const { approvalId } = useParams<{ approvalId: string }>();
  const { selectedCompanyId, setSelectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showRawPayload, setShowRawPayload] = useState(false);

  const { data: approval, isLoading } = useQuery({
    queryKey: queryKeys.approvals.detail(approvalId!),
    queryFn: () => approvalsApi.get(approvalId!),
    enabled: !!approvalId,
  });
  const resolvedCompanyId = approval?.companyId ?? selectedCompanyId;

  const { data: comments } = useQuery({
    queryKey: queryKeys.approvals.comments(approvalId!),
    queryFn: () => approvalsApi.listComments(approvalId!),
    enabled: !!approvalId,
  });

  const { data: linkedIssues } = useQuery({
    queryKey: queryKeys.approvals.issues(approvalId!),
    queryFn: () => approvalsApi.listIssues(approvalId!),
    enabled: !!approvalId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(resolvedCompanyId ?? ""),
    queryFn: () => agentsApi.list(resolvedCompanyId ?? ""),
    enabled: !!resolvedCompanyId,
  });

  const { data: goals } = useQuery({
    queryKey: queryKeys.goals.list(resolvedCompanyId ?? ""),
    queryFn: () => goalsApi.list(resolvedCompanyId ?? ""),
    enabled: !!resolvedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(resolvedCompanyId ?? ""),
    queryFn: () => projectsApi.list(resolvedCompanyId ?? ""),
    enabled: !!resolvedCompanyId,
  });

  const intakePayload = useMemo(() => {
    if (!approval || approval.type !== "issue_intake_plan") return null;
    const parsed = issueIntakePlanPayloadSchema.safeParse(approval.payload);
    return parsed.success ? parsed.data : null;
  }, [approval]);

  const [draftPayload, setDraftPayload] = useState<IssueIntakePlanPayload | null>(null);

  useEffect(() => {
    setDraftPayload(intakePayload ? cloneIntakePayload(intakePayload) : null);
  }, [intakePayload, approval?.id, approval?.updatedAt]);

  useEffect(() => {
    if (!approval?.companyId || approval.companyId === selectedCompanyId) return;
    setSelectedCompanyId(approval.companyId, { source: "route_sync" });
  }, [approval?.companyId, selectedCompanyId, setSelectedCompanyId]);

  const agentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const agent of agents ?? []) map.set(agent.id, agent.name);
    return map;
  }, [agents]);

  const agentOptions = useMemo<IntakeSelectOption[]>(
    () =>
      [...(agents ?? [])]
        .filter((agent) => agent.status !== "terminated")
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((agent) => ({ value: agent.id, label: agent.name })),
    [agents],
  );

  const goalOptions = useMemo<IntakeSelectOption[]>(
    () =>
      [...(goals ?? [])]
        .sort((a: Goal, b: Goal) => a.title.localeCompare(b.title))
        .map((goal: Goal) => ({ value: goal.id, label: goal.title })),
    [goals],
  );

  const projectOptions = useMemo<IntakeSelectOption[]>(
    () =>
      [...(projects ?? [])]
        .sort((a: Project, b: Project) => a.name.localeCompare(b.name))
        .map((project: Project) => ({ value: project.id, label: project.name })),
    [projects],
  );

  useEffect(() => {
    setBreadcrumbs([
      { label: "Approvals", href: "/approvals" },
      { label: approval?.id?.slice(0, 8) ?? approvalId ?? "Approval" },
    ]);
  }, [setBreadcrumbs, approval, approvalId]);

  const refresh = () => {
    if (!approvalId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.approvals.detail(approvalId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.approvals.comments(approvalId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.approvals.issues(approvalId) });
    if (approval?.companyId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(approval.companyId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.approvals.list(approval.companyId, "pending"),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(approval.companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(approval.companyId) });
    }
  };

  const approveMutation = useMutation({
    mutationFn: () => approvalsApi.approve(approvalId!),
    onSuccess: () => {
      setError(null);
      refresh();
      navigate(`/approvals/${approvalId}?resolved=approved`, { replace: true });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Approve failed"),
  });

  const rejectMutation = useMutation({
    mutationFn: () => approvalsApi.reject(approvalId!),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Reject failed"),
  });

  const revisionMutation = useMutation({
    mutationFn: () => approvalsApi.requestRevision(approvalId!),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Revision request failed"),
  });

  const resubmitMutation = useMutation({
    mutationFn: () => approvalsApi.resubmit(approvalId!),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Resubmit failed"),
  });

  const saveIntakePayloadMutation = useMutation({
    mutationFn: (payload: IssueIntakePlanPayload) => approvalsApi.updatePayload(approvalId!, payload),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Save failed"),
  });

  const materializeMutation = useMutation({
    mutationFn: () => approvalsApi.materializeIntake(approvalId!),
    onSuccess: (result) => {
      setError(null);
      refresh();
      for (const issue of result.issues) {
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(issue.identifier ?? issue.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(issue.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.approvals(issue.id) });
      }
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Materialize failed"),
  });

  const addCommentMutation = useMutation({
    mutationFn: () => approvalsApi.addComment(approvalId!, commentBody.trim()),
    onSuccess: () => {
      setCommentBody("");
      setError(null);
      refresh();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Comment failed"),
  });

  const deleteAgentMutation = useMutation({
    mutationFn: (agentId: string) => agentsApi.remove(agentId),
    onSuccess: () => {
      setError(null);
      refresh();
      navigate("/approvals");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Delete failed"),
  });

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (!approval) return <p className="text-sm text-muted-foreground">Approval not found.</p>;

  const payload = approval.payload as Record<string, unknown>;
  const linkedAgentId = typeof payload.agentId === "string" ? payload.agentId : null;
  const isActionable = approval.status === "pending" || approval.status === "revision_requested";
  const isIntakeApproval = approval.type === "issue_intake_plan";
  const currentIntakePayload = draftPayload ?? intakePayload;
  const hasUnsavedIntakeChanges =
    Boolean(intakePayload && draftPayload) &&
    JSON.stringify(draftPayload) !== JSON.stringify(intakePayload);
  const canEditIntake = Boolean(isIntakeApproval && currentIntakePayload && isActionable);
  const canMaterializeIntake = Boolean(
    isIntakeApproval &&
      intakePayload &&
      approval.status === "approved" &&
      !intakePayload.materialization?.createdIssueIds?.length,
  );
  const materializedIssueCount = intakePayload?.materialization?.createdIssueIds?.length ?? 0;
  const TypeIcon = typeIcon[approval.type] ?? defaultTypeIcon;
  const showApprovedBanner = searchParams.get("resolved") === "approved" && approval.status === "approved";
  const primaryLinkedIssue = linkedIssues?.[0] ?? null;
  const resolvedCta =
    primaryLinkedIssue
      ? {
          label:
            (linkedIssues?.length ?? 0) > 1
              ? "Review linked issues"
              : "Review linked issue",
          to: `/issues/${primaryLinkedIssue.identifier ?? primaryLinkedIssue.id}`,
        }
      : linkedAgentId
        ? {
            label: "Open hired agent",
            to: `/agents/${linkedAgentId}`,
          }
        : {
            label: "Back to approvals",
            to: "/approvals",
          };
  const updateParentNode = (nextNode: IssueIntakeDraftNode) => {
    setDraftPayload((current) =>
      current
        ? {
            ...current,
            proposal: {
              ...current.proposal,
              parent: nextNode,
            },
          }
        : current,
    );
  };

  const updateChildNode = (index: number, nextNode: IssueIntakeDraftNode) => {
    setDraftPayload((current) => {
      if (!current) return current;
      const children = current.proposal.children.map((child, childIndex) =>
        childIndex === index ? nextNode : child,
      );
      return {
        ...current,
        proposal: {
          ...current.proposal,
          children,
        },
      };
    });
  };

  const moveChild = (index: number, direction: -1 | 1) => {
    setDraftPayload((current) => {
      if (!current) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.proposal.children.length) return current;
      const children = [...current.proposal.children];
      const [child] = children.splice(index, 1);
      children.splice(nextIndex, 0, child);
      return {
        ...current,
        proposal: {
          ...current.proposal,
          children,
        },
      };
    });
  };

  const removeChild = (index: number) => {
    setDraftPayload((current) => {
      if (!current || current.proposal.children.length <= 1) return current;
      return {
        ...current,
        proposal: {
          ...current.proposal,
          children: current.proposal.children.filter((_, childIndex) => childIndex !== index),
        },
      };
    });
  };

  const addChild = () => {
    setDraftPayload((current) => {
      if (!current || current.proposal.children.length >= 5) return current;
      return {
        ...current,
        proposal: {
          ...current.proposal,
          children: [
            ...current.proposal.children,
            makeChildDraft(current.proposal.parent, current.proposal.children.length),
          ],
        },
      };
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {showApprovedBanner && (
        <div className="border border-green-300 dark:border-green-700/40 bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-3 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <div className="relative mt-0.5">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-300" />
                <Sparkles className="h-3 w-3 text-green-500 dark:text-green-200 absolute -right-2 -top-1 animate-pulse" />
              </div>
              <div>
                <p className="text-sm text-green-800 dark:text-green-100 font-medium">
                  {canMaterializeIntake ? "Review confirmed" : "Approval confirmed"}
                </p>
                <p className="text-xs text-green-700 dark:text-green-200/90">
                  {canMaterializeIntake
                    ? "The intake draft is approved. Materialize it to update the source issue and create child issues."
                    : "Requesting agent was notified to review this approval and linked issues."}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-green-400 dark:border-green-600/50 text-green-800 dark:text-green-100 hover:bg-green-100 dark:hover:bg-green-900/30"
              onClick={() => navigate(resolvedCta.to)}
            >
              {resolvedCta.label}
            </Button>
          </div>
        </div>
      )}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <h2 className="text-lg font-semibold">{typeLabel[approval.type] ?? approval.type.replace(/_/g, " ")}</h2>
              <p className="text-xs text-muted-foreground font-mono">{approval.id}</p>
            </div>
          </div>
          <StatusBadge status={approval.status} />
        </div>
        <div className="text-sm space-y-1">
          {approval.requestedByAgentId && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Requested by</span>
              <Identity
                name={agentNameById.get(approval.requestedByAgentId) ?? approval.requestedByAgentId.slice(0, 8)}
                size="sm"
              />
            </div>
          )}
          <ApprovalPayloadRenderer type={approval.type} payload={payload} />
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
            onClick={() => setShowRawPayload((v) => !v)}
          >
            <ChevronRight className={`h-3 w-3 transition-transform ${showRawPayload ? "rotate-90" : ""}`} />
            See full request
          </button>
          {showRawPayload && (
            <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-x-auto">
              {JSON.stringify(payload, null, 2)}
            </pre>
          )}
          {approval.decisionNote && (
            <p className="text-xs text-muted-foreground">Decision note: {approval.decisionNote}</p>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {linkedIssues && linkedIssues.length > 0 && (
          <div className="pt-2 border-t border-border/60">
            <p className="text-xs text-muted-foreground mb-1.5">Linked Issues</p>
            <div className="space-y-1.5">
              {linkedIssues.map((issue) => (
                <Link
                  key={issue.id}
                  to={`/issues/${issue.identifier ?? issue.id}`}
                  className="block text-xs rounded border border-border/70 px-2 py-1.5 hover:bg-accent/20"
                >
                  <span className="font-mono text-muted-foreground mr-2">
                    {issue.identifier ?? issue.id.slice(0, 8)}
                  </span>
                  <span>{issue.title}</span>
                </Link>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Linked issues remain open until the requesting agent follows up and closes them.
            </p>
          </div>
        )}
        {isIntakeApproval && currentIntakePayload && (
          <div className="pt-2 border-t border-border/60 space-y-2">
            <p className="text-xs text-muted-foreground">
              Source request: {currentIntakePayload.rawRequest.title}
            </p>
            {currentIntakePayload.rawRequest.description && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
                {currentIntakePayload.rawRequest.description}
              </div>
            )}
            {currentIntakePayload.proposal.notes.length > 0 && (
              <div className="space-y-1">
                {currentIntakePayload.proposal.notes.map((note, index) => (
                  <p key={`${index}-${note}`} className="text-[11px] text-muted-foreground">
                    {note}
                  </p>
                ))}
              </div>
            )}
            {materializedIssueCount > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Materialized {materializedIssueCount} linked issue{materializedIssueCount === 1 ? "" : "s"} from this review.
              </p>
            )}
            {hasUnsavedIntakeChanges && isActionable && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Save intake edits before approving or requesting revision.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {canEditIntake && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => currentIntakePayload && saveIntakePayloadMutation.mutate(currentIntakePayload)}
              disabled={!hasUnsavedIntakeChanges || saveIntakePayloadMutation.isPending}
            >
              {saveIntakePayloadMutation.isPending ? "Saving..." : "Save intake edits"}
            </Button>
          )}
          {isActionable && (
            <>
              <Button
                size="sm"
                className="bg-green-700 hover:bg-green-600 text-white"
                onClick={() => {
                  if (hasUnsavedIntakeChanges) {
                    setError("Save intake edits before approval.");
                    return;
                  }
                  approveMutation.mutate();
                }}
                disabled={approveMutation.isPending}
              >
                Approve
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
              >
                Reject
              </Button>
            </>
          )}
          {approval.status === "pending" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (hasUnsavedIntakeChanges) {
                  setError("Save intake edits before requesting revision.");
                  return;
                }
                revisionMutation.mutate();
              }}
              disabled={revisionMutation.isPending}
            >
              Request revision
            </Button>
          )}
          {approval.status === "revision_requested" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (hasUnsavedIntakeChanges) {
                  setError("Save intake edits before resubmitting.");
                  return;
                }
                resubmitMutation.mutate();
              }}
              disabled={resubmitMutation.isPending}
            >
              Mark resubmitted
            </Button>
          )}
          {approval.status === "rejected" && approval.type === "hire_agent" && linkedAgentId && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/40"
              onClick={() => {
                if (!window.confirm("Delete this disapproved agent? This cannot be undone.")) return;
                deleteAgentMutation.mutate(linkedAgentId);
              }}
              disabled={deleteAgentMutation.isPending}
            >
              Delete disapproved agent
            </Button>
          )}
          {canMaterializeIntake && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => materializeMutation.mutate()}
              disabled={materializeMutation.isPending}
            >
              {materializeMutation.isPending ? "Applying..." : "Apply reviewed intake"}
            </Button>
          )}
        </div>
      </div>

      {isIntakeApproval && currentIntakePayload && (
        <div className="border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">Issue Intake Review</h3>
              <p className="text-xs text-muted-foreground">
                Edit the proposed parent and child issues, then save and approve.
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>{currentIntakePayload.proposal.children.length} child draft{currentIntakePayload.proposal.children.length === 1 ? "" : "s"}</div>
              <div>Source issue {currentIntakePayload.sourceIssueId.slice(0, 8)}</div>
            </div>
          </div>

          <IntakeNodeEditor
            label="Parent issue"
            node={currentIntakePayload.proposal.parent}
            editable={canEditIntake}
            agentOptions={agentOptions}
            goalOptions={goalOptions}
            projectOptions={projectOptions}
            onChange={updateParentNode}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium">Child issues</h4>
              <Button
                size="sm"
                variant="outline"
                onClick={addChild}
                disabled={!canEditIntake || currentIntakePayload.proposal.children.length >= 5}
              >
                Add child
              </Button>
            </div>
            {currentIntakePayload.proposal.children.map((child, index) => (
              <IntakeNodeEditor
                key={`${index}-${child.title}`}
                label={`Child ${index + 1}`}
                node={child}
                editable={canEditIntake}
                agentOptions={agentOptions}
                goalOptions={goalOptions}
                projectOptions={projectOptions}
                onChange={(nextNode) => updateChildNode(index, nextNode)}
                actions={
                  canEditIntake ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveChild(index, -1)}
                        disabled={index === 0}
                      >
                        Up
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveChild(index, 1)}
                        disabled={index === currentIntakePayload.proposal.children.length - 1}
                      >
                        Down
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeChild(index)}
                        disabled={currentIntakePayload.proposal.children.length <= 1}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : null
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-medium">Comments ({comments?.length ?? 0})</h3>
        <div className="space-y-2">
          {(comments ?? []).map((comment: ApprovalComment) => (
            <div key={comment.id} className="border border-border/60 rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                {comment.authorAgentId ? (
                  <Link to={`/agents/${comment.authorAgentId}`} className="hover:underline">
                    <Identity
                      name={agentNameById.get(comment.authorAgentId) ?? comment.authorAgentId.slice(0, 8)}
                      size="sm"
                    />
                  </Link>
                ) : (
                  <Identity name="Board" size="sm" />
                )}
                <span className="text-xs text-muted-foreground">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
              </div>
              <MarkdownBody className="text-sm">{comment.body}</MarkdownBody>
            </div>
          ))}
        </div>
        <Textarea
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => addCommentMutation.mutate()}
            disabled={!commentBody.trim() || addCommentMutation.isPending}
          >
            {addCommentMutation.isPending ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
