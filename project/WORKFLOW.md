# Project Workflow

## Canonical state

Each independently verifiable outcome is one `DSN-NNN-short-title.md` file. Its directory is its status; never add a duplicate Status field.

`backlog → ready → in-progress → review → done`

Allowed side transitions:
- `in-progress → blocked`
- `blocked → ready | in-progress | deferred`
- `backlog | ready | in-progress → deferred`
- `review → in-progress | done`

## Prepare and claim

1. Ensure the outcome is bounded, acceptance is derived from the PRD or an accepted decision, and dependencies are explicit.
2. Move prepared work from `backlog` to `ready`.
3. Claiming a `ready` task is a serialized integration action: the integrator moves it to `in-progress` with `git mv` on shared `main` and commits the claim with the sole owner, start time, intended branch/worktree, and owned paths.
4. Only after the claim commit is on shared `main` may the owner create the task branch and isolated worktree from that commit and begin editing. Confirm the task is no longer in `ready` before starting work.
5. Never claim overlapping paths. Shared files require the integrator to serialize work.

## Implement and hand off

Use `task/DSN-NNN-short-title` in an isolated worktree, make atomic commits prefixed with the task ID, and keep work inside declared paths. Before handoff, record changed paths, commits, commands/results, limitations, unresolved risks, and next action.

Move to `review` only when implementation and declared checks are complete. The integrator independently reviews the change and confirms that all acceptance checks pass. After integrating it into `main`, the integrator records the integration commit and post-integration verification evidence; only then may the task move to `done`.

## Blocked and deferred

Blocked work remains desired but cannot progress. Record the blocking condition, evidence, who can unblock it, and the next action.

Deferred work is intentionally removed from current execution. Record rationale, remaining risk, and a concrete resume condition. Deferral is never a synonym for forgotten.

## Core and stretch gate

No stretch task may move to `ready` or `in-progress` until every Core MVP Cup-ready gate in the PRD passes, unless the founder explicitly changes the gate.

## GitHub migration

If a GitHub remote and authenticated access for all agents are established, migrate active tasks once to GitHub Issues and one Project. Archive local task records, update both `AGENTS.md` and `project/WORKFLOW.md` to name the new canonical tracker, and never operate both trackers concurrently.
