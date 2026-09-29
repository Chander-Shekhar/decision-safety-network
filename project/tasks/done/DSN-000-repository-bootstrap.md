# DSN-000: Bootstrap repository operating system

- **Scope:** infrastructure
- **Priority:** P0
- **Owner:** Primary agent
- **Branch/worktree:** main / repository root
- **Owned paths:** `AGENTS.md`, `README.md`, `SUBMISSION_PLAN.txt`, `.gitignore`, `.editorconfig`, `.github/`, `project/`, and repository scaffold design/plan files
- **Dependencies:** Product baseline commit `bb07438`
- **PRD references:** Repository support only; product scope unchanged
- **Decision references:** `docs/superpowers/specs/2026-09-28-repository-operating-system-design.md`
- **Started:** 2026-09-28
- **Last updated:** 2026-09-29

## Outcome

A local Git repository with one authoritative multi-agent workflow, task lifecycle, decision process, and deadline reference.

## Boundaries

- Includes repository instructions, navigation, task tracking, implementation decision records, review template, and structural verification.
- Excludes application architecture, technology-stack selection, feature decomposition, product implementation, remote creation, and PRD changes.

## Acceptance checks

- [x] Git uses `main` and the final working tree is clean.
- [x] The PRD is tracked and its SHA-256 remains `548bdc6c81b908ff58daf654c0a6daaa29de1f4df0a1274f32128d4c6a7c712c`.
- [x] `AGENTS.md` defines authority, read order, ownership, concurrency, decisions, verification, handoff, and scope-change rules.
- [x] `SUBMISSION_PLAN.txt` contains the agreed deadline phases once.
- [x] Every task state directory, task template, workflow guide, and seeded record exists.
- [x] Decision-record rules and template exist without duplicating PRD decisions.
- [x] The pull-request template and stack-neutral ignore/editor rules exist.
- [x] The workflow requires no external service.
- [x] No duplicate live tracker or product summary exists.
- [x] The structural audit passes and Git records the bootstrap.

## Verification evidence

- **Commits:** `a598ada DSN-000: add repository operating rules`; `8ae4729 DSN-000: add repository task lifecycle`; `c5f95a3 DSN-000: add decision and review controls`; the enclosing verification commit closes this record. These IDs reflect the pre-publication identity rewrite.
- **Commands and results:** `PASS: repository structural audit`; PRD SHA-256 `548bdc6c81b908ff58daf654c0a6daaa29de1f4df0a1274f32128d4c6a7c712c`; Pandoc validation and `git diff --check` passed before closure.
- **Changed paths:** `AGENTS.md`, `README.md`, `SUBMISSION_PLAN.txt`, `.gitignore`, `.editorconfig`, `.github/pull_request_template.md`, `project/WORKFLOW.md`, `project/tasks/`, `project/decisions/`, and the repository scaffold design/plan files.
- **Limitations or skipped checks:** None.

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Move DSN-001 to `ready`, claim it through the shared-`main` protocol, and use it to propose the technology stack and implementation architecture for approval.
- **Unresolved issues:** None recorded.
