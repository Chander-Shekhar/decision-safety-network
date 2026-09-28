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
3. Before editing, the sole owner moves it to `in-progress` with `git mv` and records owner, start time, branch/worktree, and owned paths.
4. Never claim overlapping paths. Shared files require the integrator to serialize work.

## Implement and hand off

Use `task/DSN-NNN-short-title`, make atomic commits prefixed with the task ID, and keep work inside declared paths. Before handoff, record changed paths, commits, commands/results, limitations, unresolved risks, and next action.

Move to `review` only when implementation and declared checks are complete. The integrator independently reviews, runs relevant checks, merges, records integration evidence, and then moves the task to `done`.

## Blocked and deferred

Blocked work remains desired but cannot progress. Record the blocking condition, evidence, who can unblock it, and the next action.

Deferred work is intentionally removed from current execution. Record rationale, remaining risk, and a concrete resume condition. Deferral is never a synonym for forgotten.

## Core and stretch gate

No stretch task may move to `ready` or `in-progress` until every Core MVP Cup-ready gate in the PRD passes, unless the founder explicitly changes the gate.

## GitHub migration

If a GitHub remote and authenticated access for all agents are established, migrate active tasks once to GitHub Issues and one Project. Archive local task records, update `AGENTS.md`, and never operate both trackers concurrently.
