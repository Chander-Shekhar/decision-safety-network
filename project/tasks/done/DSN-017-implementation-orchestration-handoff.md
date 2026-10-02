# DSN-017: Approved implementation handoff for Claude Code

- **Scope:** infrastructure
- **Priority:** P0
- **Owner:** Primary agent (serialized documentation integrator)
- **Branch/worktree:** `task/DSN-017-implementation-orchestration-handoff` / `.worktrees/dsn-017-implementation-orchestration-handoff`
- **Owned paths:** `AGENTS.md`, `README.md`, `CLAUDE.md`, `docs/design/wireframes/README.md`, `docs/design/wireframes/index.html`, `docs/implementation/claude-code-orchestrator-prompt.md`, and this task record (serialized integrator ownership)
- **Dependencies:** DSN-001, DSN-016
- **PRD references:** Part I Core MVP C1–C12, Cup-ready definition, trust/privacy/accessibility gates
- **Decision references:** Accepted decision 0001 and founder-approved wireframes and implementation plan, 2026-10-03
- **Started:** 2026-10-03 IST
- **Last updated:** 2026-10-03 IST

## Outcome

Make the approved Core MVP plan and wireframes unambiguous to incoming implementation/review agents, and provide a copy-ready prompt for Claude Code to orchestrate the implementation, independent reviews, fixes, and local integration while the founder retains product authority.

## Boundaries

- Includes repository entry-point pointers, approved wireframe status, Claude Code instruction bridge, and orchestration handoff instructions.
- Excludes product code, changes to the locked PRD or approved behavior, remote pushes, cloud resources, deployments, and external submission.

## Acceptance checks

- [x] Repo entry points direct agents to the approved plan, wireframe guide, canonical task workflow, PRD, and decisions without duplicating product requirements.
- [x] Wireframe guide/gallery accurately state founder-approved implementation guidance while keeping brand/pixel decisions open and PRD authority intact.
- [x] Claude Code prompt defines bounded task claim/ownership, implementer → independent reviewer → fix/re-review → integrator verification, durable evidence, stop/escalation gates, and final Codex review handoff.
- [x] No alternate task/status tracker is introduced; repo rules remain consistent with `project/WORKFLOW.md`; the public repository gains no secrets, workplace identity, or private local paths.
- [x] Markdown and links validate, `git diff --check` passes, and the locked PRD checksum remains unchanged. An independent reviewer finds no material contradiction.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits:** `070a086` (entry points, approved UI status, Claude Code prompt); `2497570` (review handoff)
- **Integration commit:** `ec36d4e` on local `main`
- **Commands and results:** `pandoc -f gfm -t html -o /dev/null` parsed every changed Markdown document; `xmllint --noout docs/design/wireframes/*.svg` passed; `git diff --cached --check` passed. Independent read-only review confirmed local links and all seven SVGs exist, and found no material product, workflow, privacy, or permission contradiction. Its two wording findings were fixed: the new prompt is described as prepared rather than founder-approved, and README's implementation state is dated. A scoped independent re-review confirmed both fixes and no remaining finding. A scan found no stale draft labels, private absolute paths, workplace email, or private-key marker in changed documents. Locked PRD SHA-256 remained `548bdc6c81b908ff58daf654c0a6daaa29de1f4df0a1274f32128d4c6a7c712c`.
- **Post-integration verification:** On merged local `main`, `pandoc` parsed the entry points, wireframe guide, prompt, and approved plan; `xmllint --noout` parsed all SVG frames; every plan wireframe link resolved; `git show --check HEAD` passed; locked PRD SHA-256 matched `548bdc6c81b908ff58daf654c0a6daaa29de1f4df0a1274f32128d4c6a7c712c`; worktree was clean before this completion record. No product test suite exists yet.
- **Changed paths:** `AGENTS.md`, `README.md`, `CLAUDE.md`, `docs/design/wireframes/README.md`, `docs/design/wireframes/index.html`, `docs/implementation/claude-code-orchestrator-prompt.md`, and this task record.
- **Limitations or skipped checks:** This is a documentation handoff, not executed product implementation. Claude Code has not yet run the prompt, and no product test suite exists.

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Present the prepared prompt to the founder for use in Claude Code. Its orchestrator should begin with Git/task-state inspection, then claim and implement DSN-003 onward under the canonical workflow. Future product-code pushes and cloud deployment need separate authorization.
- **Unresolved issues:** No product or cloud decision is required for this handoff; future implementation pushes and deployment remain separately gated.
