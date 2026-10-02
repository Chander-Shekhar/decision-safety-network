# DSN-017: Approved implementation handoff for Claude Code

- **Scope:** infrastructure
- **Priority:** P0
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** `AGENTS.md`, `README.md`, `CLAUDE.md`, `docs/design/wireframes/README.md`, `docs/design/wireframes/index.html`, `docs/implementation/claude-code-orchestrator-prompt.md`, and this task record (serialized integrator ownership)
- **Dependencies:** DSN-001, DSN-016
- **PRD references:** Part I Core MVP C1–C12, Cup-ready definition, trust/privacy/accessibility gates
- **Decision references:** Accepted decision 0001 and founder-approved wireframes and implementation plan, 2026-10-03
- **Started:** Not started
- **Last updated:** 2026-10-03 IST

## Outcome

Make the approved Core MVP plan and wireframes unambiguous to incoming implementation/review agents, and provide a copy-ready prompt for Claude Code to orchestrate the implementation, independent reviews, fixes, and local integration while the founder retains product authority.

## Boundaries

- Includes repository entry-point pointers, approved wireframe status, Claude Code instruction bridge, and orchestration handoff instructions.
- Excludes product code, changes to the locked PRD or approved behavior, remote pushes, cloud resources, deployments, and external submission.

## Acceptance checks

- [ ] Repo entry points direct agents to the approved plan, wireframe guide, canonical task workflow, PRD, and decisions without duplicating product requirements.
- [ ] Wireframe guide/gallery accurately state founder-approved implementation guidance while keeping brand/pixel decisions open and PRD authority intact.
- [ ] Claude Code prompt defines bounded task claim/ownership, implementer → independent reviewer → fix/re-review → integrator verification, durable evidence, stop/escalation gates, and final Codex review handoff.
- [ ] No alternate task/status tracker is introduced; repo rules remain consistent with `project/WORKFLOW.md`; the public repository gains no secrets, workplace identity, or private local paths.
- [ ] Markdown and links validate, `git diff --check` passes, and the locked PRD checksum remains unchanged. An independent reviewer finds no material contradiction.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits:** None
- **Integration commit:** Not integrated
- **Commands and results:** None
- **Post-integration verification:** Not run
- **Changed paths:** None
- **Limitations or skipped checks:** None

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Claim on main, create isolated worktree, then implement the documentation and prompt changes.
- **Unresolved issues:** No product or cloud decision is required for this handoff; future implementation pushes and deployment remain separately gated.
