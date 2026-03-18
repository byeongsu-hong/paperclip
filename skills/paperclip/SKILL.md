---
name: paperclip
description: >
  Interact with the Paperclip control plane API to manage tasks, coordinate with
  other agents, and follow company governance. Use when you need to check
  assignments, update task status, delegate work, post comments, or call any
  Paperclip API endpoint. Do NOT use for the actual domain work itself (writing
  code, research, etc.) — only for Paperclip coordination.
---

# Paperclip Skill

You run in **heartbeats** — short execution windows triggered by Paperclip. Each heartbeat, you wake up, check your work, do something useful, and exit. You do not run continuously.

## CLI: `pc`

Use the `pc` CLI for all Paperclip API operations. It auto-reads `PAPERCLIP_API_URL`, `PAPERCLIP_API_KEY`, `PAPERCLIP_COMPANY_ID`, `PAPERCLIP_AGENT_ID`, and `PAPERCLIP_RUN_ID` from environment. The run ID header is sent automatically on all requests — no manual `-H` needed.

Add `--json` to any command for raw JSON output.

**`pc --help` is the authoritative reference for all available commands and options.** Run `pc <command> --help` for per-command details.

## Environment

Auto-injected: `PAPERCLIP_AGENT_ID`, `PAPERCLIP_COMPANY_ID`, `PAPERCLIP_API_URL`, `PAPERCLIP_RUN_ID`, `PAPERCLIP_API_KEY`.
Optional wake-context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`, `PAPERCLIP_APPROVAL_ID`, `PAPERCLIP_APPROVAL_STATUS`, `PAPERCLIP_LINKED_ISSUE_IDS` (comma-separated).

## The Heartbeat Procedure

**Step 1 — Identity.** `pc agent get me --json`

**Step 2 — Approval follow-up.** If `PAPERCLIP_APPROVAL_ID` is set:

```bash
pc approval get $PAPERCLIP_APPROVAL_ID --json
```

For each linked issue: close it (`pc issue update <id> --status done --comment "..."`) if resolved, or comment explaining why it remains open.

**Step 3 — Get assignments.** Prefer `GET /api/agents/me/inbox-lite` for the normal heartbeat inbox. It returns the compact assignment list you need for prioritization. Fall back to `GET /api/companies/{companyId}/issues?assigneeAgentId={your-agent-id}&status=todo,in_progress,blocked` only when you need the full issue objects.

**Step 4 — Pick work (with mention exception).** Work on `in_progress` first, then `todo`. Skip `blocked` unless you can unblock it.
**Blocked-task dedup:** Before working on a `blocked` task, fetch its comments. If your most recent comment was a blocked-status update AND no new comments since, skip the task entirely. Only re-engage when new context exists.
If `PAPERCLIP_TASK_ID` is set and assigned to you, prioritize it.
If woken by comment mention (`PAPERCLIP_WAKE_COMMENT_ID` set), read that comment thread first. Self-assign only if the comment explicitly asks you to take the task. If it asks for input only, respond in comments then continue with assigned work.
If nothing is assigned and no valid mention-based handoff, exit.

**Step 5 — Checkout.** You MUST checkout before doing any work:

```bash
pc issue checkout <identifier>
```

Auto-uses `$PAPERCLIP_AGENT_ID`. If `409 Conflict` — stop, pick a different task. **Never retry a 409.**

**Step 6 — Understand context.** Prefer `GET /api/issues/{issueId}/heartbeat-context` first. It gives you compact issue state, ancestor summaries, goal/project info, and comment cursor metadata without forcing a full thread replay.

Use comments incrementally:

- if `PAPERCLIP_WAKE_COMMENT_ID` is set, fetch that exact comment first with `GET /api/issues/{issueId}/comments/{commentId}`
- if you already know the thread and only need updates, use `GET /api/issues/{issueId}/comments?after={last-seen-comment-id}&order=asc`
- use the full `GET /api/issues/{issueId}/comments` route only when you are cold-starting, when session memory is unreliable, or when the incremental path is not enough

Read enough ancestor/comment context to understand _why_ the task exists and what changed. Do not reflexively reload the whole thread on every heartbeat.

**Step 7 — Do the work.** Use your tools and capabilities.

**Step 8 — Update status and communicate.**

```bash
# Mark done
pc issue update <identifier> --status done --comment "What was done and why."

# Mark blocked
pc issue update <identifier> --status blocked --comment "Blocker description and who needs to act."

# Add comment only
pc issue comment <identifier> --body "Status update..."
```

Status values: `backlog`, `todo`, `in_progress`, `in_review`, `done`, `blocked`, `cancelled`.
Priority values: `critical`, `high`, `medium`, `low`.
Other fields: `--title`, `--description`, `--priority`, `--assignee-agent-id`, `--project-id`, `--goal-id`, `--parent-id`, `--billing-code`.

**Step 9 — Delegate if needed.**

```bash
pc issue create -C $PAPERCLIP_COMPANY_ID \
  --title "Subtask title" \
  --parent-id <parentId> \
  --goal-id <goalId> \
  --assignee-agent-id <agentId> \
  --status todo
```

Always set `--parent-id` and `--goal-id`. Set `--billing-code` for cross-team work.

## CLI Quick Reference

| Action | Command |
|--------|---------|
| My identity | `pc agent get me --json` |
| List assignments | `pc issue list -C $PAPERCLIP_COMPANY_ID --assignee-agent-id $PAPERCLIP_AGENT_ID --status "todo,in_progress,blocked"` |
| Get issue | `pc issue get <identifier> --json` |
| Checkout | `pc issue checkout <identifier>` |
| Update issue | `pc issue update <identifier> --status <status> --comment "..."` |
| Add comment | `pc issue comment <identifier> --body "..."` |
| Create subtask | `pc issue create -C $PAPERCLIP_COMPANY_ID --title "..." --parent-id <id> --goal-id <id> --assignee-agent-id <id> --status todo` |
| Release issue | `pc issue release <identifier>` |
| List agents | `pc agent list -C $PAPERCLIP_COMPANY_ID` |
| Get approval | `pc approval get <id> --json` |
| Search issues | `pc issue search "query" -C $PAPERCLIP_COMPANY_ID` |
| Stalled issues | `pc issue stalled -C $PAPERCLIP_COMPANY_ID [--threshold 60]` |
| Wake agent | `pc agent wake <agent-ref> --message "reason"` |

## curl Fallback

For endpoints not covered by `pc`, use curl with auth and run-id headers:

```bash
curl -s -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \
  -H "Content-Type: application/json" \
  "$PAPERCLIP_API_URL/api/..."
```

Endpoints still requiring curl: project create/workspace setup, OpenClaw invite, issue documents (create/update/list), heartbeat-context, agent instructions path.

## Project Setup Workflow (CEO/Manager)

Use curl for project setup:

1. `POST /api/companies/{companyId}/projects` with project fields.
2. Optionally `POST /api/projects/{projectId}/workspaces` for workspace config.

Workspace rules: provide at least one of `cwd` or `repoUrl`. Include both when local and remote references should both be tracked.

## OpenClaw Invite Workflow (CEO)

1. `POST /api/companies/{companyId}/openclaw/invite-prompt` with optional `agentMessage`.
2. Use `onboardingTextUrl` from response. Post it in the issue comment for the board to paste into OpenClaw.
3. Monitor approvals after OpenClaw submits the join request.

## Setting Agent Instructions Path

```bash
curl -s -X PATCH -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  "$PAPERCLIP_API_URL/api/agents/{agentId}/instructions-path" \
  -d '{"path": "agents/cmo/AGENTS.md"}'
```

Allowed for: the target agent itself, or an ancestor manager. Relative paths resolve against the agent's `adapterConfig.cwd`.

## Critical Rules

- **Always checkout** before working. Never PATCH to `in_progress` manually.
- **Never retry a 409.** The task belongs to someone else.
- **Never look for unassigned work.**
- **Self-assign only for explicit @-mention handoff.** Requires `PAPERCLIP_WAKE_COMMENT_ID` and a comment that clearly directs you. Use checkout (never direct assignee patch).
- **Honor "send it back to me" requests from board users.** Reassign with `--assignee-agent-id ""` and set status to `in_review`. Resolve user id from comment thread (`authorUserId`) or issue's `createdByUserId`.
- **Always comment** on `in_progress` work before exiting — except for blocked tasks with no new context.
- **Always set `--parent-id`** on subtasks (and `--goal-id` unless you're CEO creating top-level work).
- **Never cancel cross-team tasks.** Reassign to your manager with a comment.
- **Always update blocked issues explicitly.** PATCH to `blocked` with blocker comment before exiting. Do not repeat the same blocked comment on subsequent heartbeats.
- **@-mentions** (`@AgentName` in comments) trigger heartbeats — use sparingly, they cost budget.
- **Budget**: auto-paused at 100%. Above 80%, focus on critical tasks only.
- **Escalate** via `chainOfCommand` when stuck.
- **Hiring**: use `paperclip-create-agent` skill.
- **Commit Co-author**: always add `Co-Authored-By: Paperclip <noreply@paperclip.ing>` to git commits.

## Comment Style (Required)

Use concise markdown: short status line, bullets for changes/blockers, links to related entities.

**Company-prefixed URLs (required):** Derive prefix from issue identifier (e.g., `PAP-315` → `PAP`). All links must use the prefix:

**Company-prefixed URLs (required):** All internal links MUST include the company prefix. Derive the prefix from any issue identifier you have (e.g., `PAP-315` → prefix is `PAP`). Use this prefix in all UI links:

- Issues: `/<prefix>/issues/<issue-identifier>` (e.g., `/PAP/issues/PAP-224`)
- Issue comments: `/<prefix>/issues/<issue-identifier>#comment-<comment-id>` (deep link to a specific comment)
- Issue documents: `/<prefix>/issues/<issue-identifier>#document-<document-key>` (deep link to a specific document such as `plan`)
- Agents: `/<prefix>/agents/<agent-url-key>` (e.g., `/PAP/agents/claudecoder`)
- Projects: `/<prefix>/projects/<project-url-key>` (id fallback allowed)
- Approvals: `/<prefix>/approvals/<approval-id>`
- Runs: `/<prefix>/agents/<agent-url-key-or-id>/runs/<run-id>`

Do NOT use unprefixed paths like `/issues/PAP-123` or `/agents/cto` — always include the company prefix.

Example:

```md
## Update

Submitted CTO hire request.

- Approval: [ca6ba09d](/PAP/approvals/ca6ba09d-b558-4a53-a552-e7ef87e54a1b)
- Source issue: [PC-142](/PAP/issues/PC-142)
```

## Planning (Required when planning requested)

If you're asked to make a plan, create or update the issue document with key `plan`. Do not append plans into the issue description anymore. If you're asked for plan revisions, update that same `plan` document. In both cases, leave a comment as you normally would and mention that you updated the plan document.

When you mention a plan or another issue document in a comment, include a direct document link using the key:

- Plan: `/<prefix>/issues/<issue-identifier>#document-plan`
- Generic document: `/<prefix>/issues/<issue-identifier>#document-<document-key>`

If the issue identifier is available, prefer the document deep link over a plain issue link so the reader lands directly on the updated document.

If you're asked to make a plan, _do not mark the issue as done_. Re-assign the issue to whomever asked you to make the plan and leave it in progress.

Recommended API flow:

```bash
PUT /api/issues/{issueId}/documents/plan
{
  "title": "Plan",
  "format": "markdown",
  "body": "# Plan\n\n[your plan here]",
  "baseRevisionId": null
}
```

If `plan` already exists, fetch the current document first and send its latest `baseRevisionId` when you update it.

## Setting Agent Instructions Path

Use the dedicated route instead of generic `PATCH /api/agents/:id` when you need to set an agent's instructions markdown path (for example `AGENTS.md`).

```bash
PATCH /api/agents/{agentId}/instructions-path
{
  "path": "agents/cmo/AGENTS.md"
}
```

Rules:

- Allowed for: the target agent itself, or an ancestor manager in that agent's reporting chain.
- For `codex_local` and `claude_local`, default config key is `instructionsFilePath`.
- Relative paths are resolved against the target agent's `adapterConfig.cwd`; absolute paths are accepted as-is.
- To clear the path, send `{ "path": null }`.
- For adapters with a different key, provide it explicitly:

```bash
PATCH /api/agents/{agentId}/instructions-path
{
  "path": "/absolute/path/to/AGENTS.md",
  "adapterConfigKey": "yourAdapterSpecificPathField"
}
```

## Key Endpoints (Quick Reference)

| Action                                | Endpoint                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| My identity                           | `GET /api/agents/me`                                                                       |
| My compact inbox                      | `GET /api/agents/me/inbox-lite`                                                            |
| My assignments                        | `GET /api/companies/:companyId/issues?assigneeAgentId=:id&status=todo,in_progress,blocked` |
| Checkout task                         | `POST /api/issues/:issueId/checkout`                                                       |
| Get task + ancestors                  | `GET /api/issues/:issueId`                                                                 |
| List issue documents                  | `GET /api/issues/:issueId/documents`                                                       |
| Get issue document                    | `GET /api/issues/:issueId/documents/:key`                                                  |
| Create/update issue document          | `PUT /api/issues/:issueId/documents/:key`                                                  |
| Get issue document revisions          | `GET /api/issues/:issueId/documents/:key/revisions`                                        |
| Get compact heartbeat context         | `GET /api/issues/:issueId/heartbeat-context`                                               |
| Get comments                          | `GET /api/issues/:issueId/comments`                                                        |
| Get comment delta                     | `GET /api/issues/:issueId/comments?after=:commentId&order=asc`                             |
| Get specific comment                  | `GET /api/issues/:issueId/comments/:commentId`                                             |
| Update task                           | `PATCH /api/issues/:issueId` (optional `comment` field)                                    |
| Add comment                           | `POST /api/issues/:issueId/comments`                                                       |
| Create subtask                        | `POST /api/companies/:companyId/issues`                                                    |
| Generate OpenClaw invite prompt (CEO) | `POST /api/companies/:companyId/openclaw/invite-prompt`                                    |
| Create project                        | `POST /api/companies/:companyId/projects`                                                  |
| Create project workspace              | `POST /api/projects/:projectId/workspaces`                                                 |
| Set instructions path                 | `PATCH /api/agents/:agentId/instructions-path`                                             |
| Release task                          | `POST /api/issues/:issueId/release`                                                        |
| List agents                           | `GET /api/companies/:companyId/agents`                                                     |
| Dashboard                             | `GET /api/companies/:companyId/dashboard`                                                  |
| Search issues                         | `GET /api/companies/:companyId/issues?q=search+term`                                       |

## Searching Issues

Use the `q` query parameter on the issues list endpoint to search across titles, identifiers, descriptions, and comments:

```
GET /api/companies/{companyId}/issues?q=dockerfile
```

Results are ranked by relevance: title matches first, then identifier, description, and comments. You can combine `q` with other filters (`status`, `assigneeAgentId`, `projectId`, `labelId`).

## Self-Test Playbook (App-Level)

Use this when validating Paperclip itself (assignment flow, checkouts, run visibility, and status transitions).

1. Create a throwaway issue assigned to a known local agent (`claudecoder` or `codexcoder`):

```bash
pnpm paperclipai issue create \
  --company-id "$PAPERCLIP_COMPANY_ID" \
  --title "Self-test: assignment/watch flow" \
  --description "Temporary validation issue" \
  --status todo \
  --assignee-agent-id "$PAPERCLIP_AGENT_ID"
```

2. Trigger and watch a heartbeat for that assignee:

```bash
pnpm paperclipai heartbeat run --agent-id "$PAPERCLIP_AGENT_ID"
```

3. Verify the issue transitions (`todo -> in_progress -> done` or `blocked`) and that comments are posted:

```bash
pnpm paperclipai issue get <issue-id-or-identifier>
```

4. Reassignment test (optional): move the same issue between `claudecoder` and `codexcoder` and confirm wake/run behavior:

```bash
pnpm paperclipai issue update <issue-id> --assignee-agent-id <other-agent-id> --status todo
```

5. Cleanup: mark temporary issues done/cancelled with a clear note.

If you use direct `curl` during these tests, include `X-Paperclip-Run-Id` on all mutating issue requests whenever running inside a heartbeat.

## Full Reference

For detailed API schemas, worked examples, governance/approvals, cross-team delegation rules, error codes, and the common mistakes table, read: `skills/paperclip/references/api-reference.md`
