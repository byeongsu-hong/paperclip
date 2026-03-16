import type { ApprovalStatus, ApprovalType } from "../constants.js";

export interface Approval {
  id: string;
  companyId: string;
  type: ApprovalType;
  requestedByAgentId: string | null;
  requestedByUserId: string | null;
  status: ApprovalStatus;
  payload: Record<string, unknown>;
  decisionNote: string | null;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueIntakePlanMaterialization {
  appliedAt: string;
  sourceIssueId: string;
  createdIssueIds: string[];
}

export interface IssueIntakePlanPayload {
  version: 1;
  sourceIssueId: string;
  rawRequest: {
    title: string;
    description: string | null;
  };
  proposal: import("./issue.js").IssueIntakeDraft;
  materialization?: IssueIntakePlanMaterialization | null;
}

export interface ApprovalComment {
  id: string;
  companyId: string;
  approvalId: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}
