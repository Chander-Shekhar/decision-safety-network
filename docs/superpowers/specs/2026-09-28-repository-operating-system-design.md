# Decision Safety Network Repository Operating System

**Status:** Implemented
**Date:** 28 September 2026  
**Applies to:** `this repository`  
**Product baseline:** `Decision_Safety_Network_PRD_Draft.md`, Draft 0.2

## Purpose

Prepare the Decision Safety Network folder for disciplined, multi-agent development through the AI Builder Cup submission deadline. The repository must make product intent, actual implementation state, active work, durable decisions, ownership, verification, blockers, deferrals, and handoffs easy to find without maintaining competing sources of truth.

The system must remain lightweight enough for a short competition timeline and usable by agents that have only repository access.

## Constraints

- The PRD is locked unless the founder explicitly requests a change.
- Code and automated tests are the source of truth for what currently works.
- The repository currently has no Git history, remote, application code, or established technology stack.
- The repository must work locally without requiring GitHub, a database, a task-tracking service, or a new CLI.
- Multiple agents may work concurrently.
- Documentation must point to the PRD instead of restating product requirements.
- Core MVP work must be completed before stretch work begins.
- A future GitHub workflow must not create a second live task tracker.

## Approaches considered

### Single task-board document

A single `TASKS.md` or status table has the smallest setup cost, but it becomes a high-conflict shared file under concurrent development. It also encourages agents to mix tasks, progress notes, decisions, and verification evidence in one place.

**Decision:** Rejected.

### GitHub Issues and Projects

GitHub Issues and Projects provide mature assignment, dependency, sub-issue, pull-request, and automation capabilities. They are the preferred option after a remote exists and all agents have authenticated access.

The current repository has no remote, so making GitHub mandatory would leave the local folder without a usable tracker.

**Decision:** Deferred until a remote is intentionally established.

### Repository-native task records

One Markdown file per independently verifiable outcome minimizes concurrent edits, travels with every worktree, works offline, and remains inspectable through ordinary file and Git tools. Directory location represents task state, while the task file records ownership, dependencies, acceptance references, evidence, and handoff information.

**Decision:** Selected.

## Source-of-truth boundaries

| Concern | Canonical source |
|---|---|
| Intended product, scope, safety boundaries, and acceptance criteria | Locked PRD |
| Actual implemented behavior | Code, configuration, and automated tests |
| Current ownership and work status | One repository task file per work item |
| Durable implementation rationale | Accepted decision records under `project/decisions/` |
| Change chronology | Git history |
| Submission phases and deadline | `SUBMISSION_PLAN.txt` |
| Mandatory contributor and agent behavior | Root `AGENTS.md` |
| Repository navigation | Root `README.md` |

No agent may introduce an alternative task list, status document, decision log, memory file, or duplicate PRD summary.

## Repository structure

```text
DecisionSafetyNetwork/
├── AGENTS.md
├── README.md
├── SUBMISSION_PLAN.txt
├── Decision_Safety_Network_PRD_Draft.md
├── .editorconfig
├── .gitignore
├── .github/
│   └── pull_request_template.md
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-09-28-repository-operating-system-design.md
└── project/
    ├── WORKFLOW.md
    ├── tasks/
    │   ├── TEMPLATE.md
    │   ├── backlog/
    │   ├── ready/
    │   ├── in-progress/
    │   ├── review/
    │   ├── blocked/
    │   ├── done/
    │   └── deferred/
    └── decisions/
        ├── README.md
        └── TEMPLATE.md
```

The PRD remains intact at its current path. It will not be split until implementation reveals a specific navigation or ownership problem that a split would solve.

## Work-item model

Each task is one Markdown file named `DSN-NNN-short-title.md`. The file moves between state directories with `git mv`; its directory is the canonical status, so status is not duplicated inside the task.

### States

```text
backlog → ready → in-progress → review → done
                       ↘ blocked
backlog | ready | in-progress → deferred
blocked → ready | in-progress | deferred
review → in-progress | done
```

- **Backlog:** worthwhile outcome not yet prepared for implementation.
- **Ready:** scoped, dependencies understood, and acceptance references available.
- **In progress:** exactly one owner has claimed the work and declared paths.
- **Review:** implementation is complete and awaits independent verification/integration.
- **Blocked:** work should continue but cannot; the blocker and next action are recorded.
- **Done:** integrated code and applicable verification evidence satisfy acceptance.
- **Deferred:** intentionally outside current execution scope; rationale and resume condition are recorded.

### Required task content

- Identifier and outcome-oriented title
- Scope class: core, stretch, submission, infrastructure, or defect
- Priority
- Owner
- Branch and worktree
- Owned paths
- Dependencies
- Relevant PRD and decision references
- Outcome and boundaries
- Derived acceptance checks
- Verification evidence
- Blocker or deferral reason when applicable
- Handoff notes and next action
- Last-updated timestamp

Task files reference PRD sections rather than copying their requirements.

## Multi-agent operating rules

The root `AGENTS.md` will require every writing agent to:

1. Read `AGENTS.md`, its assigned task, relevant PRD sections, and applicable decisions before editing.
2. Claim exactly one task by moving it to `in-progress` and recording owner, branch/worktree, and intended paths.
3. Use one isolated task branch and worktree per writing agent when agents run concurrently.
4. Avoid overlapping owned paths; shared files, schemas, lockfiles, root configuration, the PRD, and tracking rules are serialized through an integrator.
5. Inspect repository state first and preserve unrelated changes.
6. Never reset, discard, amend, overwrite, or silently absorb another agent's work.
7. Pause and coordinate before expanding beyond declared paths or task scope.
8. Keep commits atomic and include the task identifier in the subject.
9. Record verification, limitations, changed paths, commit identifiers, and the next action before handoff.
10. Move work to `done` only after integration and applicable acceptance checks pass.
11. Record explicit blocker details or deferral rationale and a resume condition.
12. Complete Core MVP work before starting stretch work unless the founder explicitly changes the gate.

Workers do not merge their own task branches into `main`; the coordinating/integrating agent reviews, verifies, and integrates them.

## Decision records

The PRD already contains accepted product and founder decisions; these will not be duplicated as ADRs.

A new decision record is required for a consequential implementation choice involving architecture, data contracts, privacy/security, model behavior, dependencies, deployment, interfaces, or a meaningful trade-off that future agents need to understand.

Each decision record contains:

- Title
- Status: Proposed, Accepted, Rejected, or Superseded
- Date
- Context
- Decision
- Consequences
- Alternatives considered
- Related task and PRD references
- Supersedes / superseded by

Accepted records are immutable. A changed decision receives a new record that supersedes the old one. A discovered product-scope change remains Proposed until the founder approves it; agents may not edit the locked PRD on their own authority.

## Git model

- Initialize the repository with `main` as the default branch.
- Track the existing PRD and all repository-control artifacts.
- Use task branches named `task/DSN-NNN-short-title`.
- Prefer isolated Git worktrees for concurrent writing agents.
- Commit subjects begin with the task identifier, for example `DSN-004: implement Safety Case state transitions`.
- Keep each commit a logically separate, reviewable change.
- Do not create a remote without explicit user authorization.
- Do not commit secrets, personal data, generated build output, local environments, or synthetic demo credentials.

## GitHub migration

If a GitHub remote is established early and all agents can use it reliably, migrate active task records once to GitHub Issues and a single Project. Archive the repository task records and update `AGENTS.md` and `WORKFLOW.md` to name GitHub as canonical.

Never maintain local task files and GitHub Issues as parallel live trackers.

The pull-request template is prepared now because it remains useful when a remote is added; it requires a task reference, scope summary, acceptance evidence, tests, risks, and remaining work.

## Initial seeded records

- `DSN-000-repository-bootstrap.md` in `done`, documenting creation of this operating system.
- `DSN-001-create-implementation-plan.md` in `backlog`, directing the next phase to turn the approved Core MVP into owned, dependency-aware implementation tasks without rewriting the PRD.

No feature task decomposition will be invented during repository bootstrap. That belongs to the implementation-planning phase.

## Acceptance criteria

Repository setup is complete when:

1. Git is initialized on `main` and the working tree is clean.
2. The copied PRD is tracked and remains byte-for-byte unchanged from the approved copy.
3. `AGENTS.md` clearly defines authority, read order, task ownership, concurrency, decision, verification, handoff, and scope-change rules.
4. The high-level deadline phases exist once in `SUBMISSION_PLAN.txt`.
5. Every task state directory, task template, workflow guide, and seeded record exists.
6. Decision-record rules and a template exist without duplicating PRD decisions.
7. The pull-request template and minimal ignore/editor rules exist.
8. The task lifecycle can be followed using ordinary Git and filesystem commands without external services.
9. No duplicate live tracker or product summary has been created.
10. The repository passes a structural audit and the final commit records the bootstrap.

## Research basis

- [AGENTS.md open format](https://agents.md/)
- [Git worktree documentation](https://git-scm.com/docs/git-worktree)
- [GitHub Projects best practices](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/best-practices-for-projects)
- [GitHub Issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/learning-about-issues/about-issues)
- [GitHub pull-request and issue linking](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
- [GOV.UK architecture decision record framework](https://www.gov.uk/government/publications/architectural-decision-record-framework)
- [AWS architecture decision record process](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html)
- [Git guidance for logical commits](https://git-scm.com/book/en/v2/Distributed-Git-Contributing-to-a-Project)
