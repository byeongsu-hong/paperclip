import { z } from "zod";
import { APPROVAL_TYPES } from "../constants.js";
import { issueIntakeDraftSchema } from "./issue.js";

export const createApprovalSchema = z.object({
  type: z.enum(APPROVAL_TYPES),
  requestedByAgentId: z.string().uuid().optional().nullable(),
  payload: z.record(z.unknown()),
  issueIds: z.array(z.string().uuid()).optional(),
});

export type CreateApproval = z.infer<typeof createApprovalSchema>;

export const resolveApprovalSchema = z.object({
  decisionNote: z.string().optional().nullable(),
  decidedByUserId: z.string().optional().default("board"),
});

export type ResolveApproval = z.infer<typeof resolveApprovalSchema>;

export const requestApprovalRevisionSchema = z.object({
  decisionNote: z.string().optional().nullable(),
  decidedByUserId: z.string().optional().default("board"),
});

export type RequestApprovalRevision = z.infer<typeof requestApprovalRevisionSchema>;

export const resubmitApprovalSchema = z.object({
  payload: z.record(z.unknown()).optional(),
});

export type ResubmitApproval = z.infer<typeof resubmitApprovalSchema>;

export const issueIntakePlanPayloadSchema = z.object({
  version: z.literal(1).default(1),
  sourceIssueId: z.string().uuid(),
  rawRequest: z.object({
    title: z.string().min(1),
    description: z.string().nullable(),
  }),
  proposal: issueIntakeDraftSchema,
  materialization: z
    .object({
      appliedAt: z.string().datetime(),
      sourceIssueId: z.string().uuid(),
      createdIssueIds: z.array(z.string().uuid()).min(1),
    })
    .optional()
    .nullable(),
});

export type IssueIntakePlanPayloadInput = z.infer<typeof issueIntakePlanPayloadSchema>;

export const updateApprovalPayloadSchema = z.object({
  payload: issueIntakePlanPayloadSchema,
  note: z.string().trim().min(1).optional(),
});

export type UpdateApprovalPayload = z.infer<typeof updateApprovalPayloadSchema>;

export const addApprovalCommentSchema = z.object({
  body: z.string().min(1),
});

export type AddApprovalComment = z.infer<typeof addApprovalCommentSchema>;
