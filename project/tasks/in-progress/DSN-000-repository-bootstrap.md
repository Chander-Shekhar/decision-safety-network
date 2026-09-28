# DSN-000: Bootstrap repository operating system

- **Scope:** infrastructure
- **Priority:** P0
- **Owner:** Primary agent
- **Branch/worktree:** main / repository root
- **Owned paths:** `AGENTS.md`, `README.md`, `SUBMISSION_PLAN.txt`, `.gitignore`, `.editorconfig`, `.github/`, `project/`, and repository scaffold design/plan files
- **Dependencies:** Product baseline commit `50606a1`
- **PRD references:** Repository support only; product scope unchanged
- **Decision references:** `docs/superpowers/specs/2026-09-28-repository-operating-system-design.md`
- **Started:** 2026-09-28
- **Last updated:** 2026-09-28

## Outcome

A local Git repository with one authoritative multi-agent workflow, task lifecycle, decision process, and deadline reference.

## Boundaries

- Includes repository instructions, navigation, task tracking, implementation decision records, review template, and structural verification.
- Excludes application architecture, technology-stack selection, feature decomposition, product implementation, remote creation, and PRD changes.

## Acceptance checks

- [ ] Git uses `main` and the final working tree is clean.
- [ ] The PRD is tracked and its SHA-256 remains `548bdc6c81b908ff58daf654c0a6daaa29de1f4df0a1274f32128d4c6a7c712c`.
- [ ] `AGENTS.md` defines authority, read order, ownership, concurrency, decisions, verification, handoff, and scope-change rules.
- [ ] `SUBMISSION_PLAN.txt` contains the agreed deadline phases once.
- [ ] Every task state directory, task template, workflow guide, and seeded record exists.
- [ ] Decision-record rules and template exist without duplicating PRD decisions.
- [ ] The pull-request template and stack-neutral ignore/editor rules exist.
- [ ] The workflow requires no external service.
- [ ] No duplicate live tracker or product summary exists.
- [ ] The structural audit passes and Git records the bootstrap.

## Verification evidence

- **Commits:** Recorded before closure with `git log --oneline --grep '^DSN-000:'`.
- **Commands and results:** Final structural audit and PRD hash recorded before closure.
- **Changed paths:** Repository-control paths declared above.
- **Limitations or skipped checks:** None expected; any observed limitation must replace this statement before closure.

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Complete the scaffold, pass the structural audit, move this record to `done`, then claim DSN-001.
- **Unresolved issues:** None recorded.
