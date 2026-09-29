# DSN-002: Establish the public Cup source repository

- **Scope:** submission
- **Priority:** P0
- **Owner:** Primary agent (serialized integrator)
- **Branch/worktree:** `task/DSN-002-public-github-submission-setup` / isolated temporary worktree (local path omitted)
- **Owned paths:** `AGENTS.md`, `README.md`, `SUBMISSION_PLAN.txt`, `docs/submission-requirements.md`, repository scaffold design/plan files, `project/tasks/done/DSN-000-repository-bootstrap.md`, and this task record
- **Dependencies:** DSN-000
- **PRD references:** Competition fit, Cup scope and proof boundary, Cup acceptance criteria
- **Decision references:** None
- **Started:** 2026-09-30
- **Last updated:** 2026-09-30

## Outcome

The current repository is safely published as the Cup's public GitHub source link, and official submission requirements are easy to find.

## Boundaries

- Includes public repository configuration, source publication, commit identity privacy, and a concise source-linked submission requirements note.
- Excludes application implementation, Google Cloud provisioning, a license choice, team registration, and actual submission artifacts.

## Acceptance checks

- [x] The GitHub repository is public, `origin` points to it, and `main` contains the local source tree.
- [x] The public history exposes no corporate commit email or local home-directory path.
- [x] The locked PRD content is unchanged, and repository instructions require personal commit identities.
- [x] A source-linked submission note records the mandatory artifacts, deadlines, and known official-page conflicts.
- [x] The public source view, repository metadata, and local Git status are verified after push.

## Verification evidence

- **Commits:** `c2651b0` (submission docs), `3768f02` (privacy and deployment wording), `ebee671` (sanitized-history references). Unpublished local commits were rewritten before first push to remove office commit emails and personal paths.
- **Integration commit:** `ebee671` on `main` (fast-forwarded task branch, then sanitized unpublished history).
- **Commands and results:** Independent audit of all 12 published-branch commits passed for no corporate email, private path, or common credential pattern; `pandoc` parsed changed Markdown; `git diff --check` passed; PRD SHA-256 remained `548bdc6c81b908ff58daf654c0a6daaa29de1f4df0a1274f32128d4c6a7c712c`.
- **Post-integration verification:** `git push -u origin main` succeeded. GitHub reported `PUBLIC`, default branch `main`, and remote SHA `ebee671775b6ce06f5dc7c933854be0442abd24e`; GitHub's README content endpoint returned the published source file. Local `git status --short --branch` was clean before this task-state update.
- **Changed paths:** `AGENTS.md`, `README.md`, `SUBMISSION_PLAN.txt`, `docs/submission-requirements.md`, repository scaffold design/plan files, `project/tasks/done/DSN-000-repository-bootstrap.md`, and this task record.
- **Limitations or skipped checks:** No deployment or application tests exist yet; those belong to later tasks. The remote currently contains only planning/scaffold content, not a working prototype.

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Independent final review, then move this record to `done` and push the task-state update.
- **Unresolved issues:** None. The founder confirmed the personal `Chander-Shekhar` GitHub account and requested no office commit identity.
