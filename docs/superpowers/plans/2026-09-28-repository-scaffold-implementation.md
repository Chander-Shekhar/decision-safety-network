# Repository Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the initialized Decision Safety Network repository into a lightweight, local-first operating system for multi-agent development and submission tracking.

**Architecture:** Keep the locked PRD intact as the product contract, put mandatory behavior in root `AGENTS.md`, and use one Markdown record per work item with directory-based status. Add append-only implementation decision records and a small navigation/submission layer; do not introduce application dependencies or a second product specification.

**Tech Stack:** Git, Markdown, plain text, EditorConfig, GitHub-compatible pull-request template, POSIX shell commands for verification.

**Spec:** `docs/superpowers/specs/2026-09-28-repository-operating-system-design.md`

## Global Constraints

- `Decision_Safety_Network_PRD_Draft.md` is locked and its expected SHA-256 is `548bdc6c81b908ff58daf654c0a6daaa29de1f4df0a1274f32128d4c6a7c712c`.
- Code, configuration, and automated tests are canonical for actual implementation state.
- Repository task files are canonical for current ownership and work status until a deliberate GitHub migration.
- The state directory is canonical; task files must not contain a second `Status` field.
- Do not split or rewrite the PRD.
- Do not create a second task list, status page, decision log, project memory, or product summary.
- Do not create a remote or install dependencies.
- Core MVP work precedes stretch work unless the founder explicitly changes the gate.
- Use one owner and one isolated branch/worktree per active writing task.
- Preserve the existing root commit `bb07438` and all unrelated filesystem content. This ID reflects the pre-publication author-email rewrite.

## Review Focus

- **Locked PRD drift:** the final hash must equal the expected SHA-256; Task 4 performs the check.
- **Competing state sources:** status must exist only in task directory placement; Task 2 checks templates and seeded records for a duplicate field.
- **Unsafe concurrent ownership:** `AGENTS.md` and `WORKFLOW.md` must require one owner, declared paths, and isolated worktrees; Tasks 1 and 2 verify both documents.
- **False completion:** the task template and workflow must require integrated code plus verification evidence before `done`; Task 2 checks the exact language.
- **Dual local/GitHub tracking:** the workflow and decision rules must require one-time migration and archival rather than mirroring; Tasks 1–3 verify this rule.

---

## File map

| File or directory | Responsibility |
|---|---|
| `AGENTS.md` | Mandatory operating contract for every agent and contributor. |
| `README.md` | Short repository entry point and links; no product-spec duplication. |
| `SUBMISSION_PLAN.txt` | The previously agreed deadline phases only. |
| `.gitignore` | Ignore secrets, OS/editor files, dependency caches, and generated output without selecting a product stack. |
| `.editorconfig` | Stable text formatting for repository control files. |
| `project/WORKFLOW.md` | Detailed task lifecycle, claiming, review, handoff, and migration procedure. |
| `project/tasks/TEMPLATE.md` | Required work-item structure without duplicated status. |
| `project/tasks/<state>/` | Canonical state of every work item. |
| `project/tasks/in-progress/DSN-000-repository-bootstrap.md` | Active bootstrap record; moved to `done` only after the final audit. |
| `project/tasks/backlog/DSN-001-create-implementation-plan.md` | Next product-development outcome; decomposes Core MVP after bootstrap. |
| `project/decisions/README.md` | ADR creation, immutability, numbering, and product-scope rules. |
| `project/decisions/TEMPLATE.md` | Required implementation decision-record structure. |
| `.github/pull_request_template.md` | Future review checklist tied to task, acceptance, verification, and risk. |

---

### Task 1: Establish repository navigation and mandatory agent rules

**Files:**
- Create: `AGENTS.md`
- Create: `README.md`
- Create: `SUBMISSION_PLAN.txt`
- Create: `.gitignore`
- Create: `.editorconfig`

**Interfaces:**
- Consumes: the locked PRD and approved repository operating-system spec.
- Produces: the canonical contributor read order and repository-wide rules used by every later task.

- [ ] **Step 1: Verify the starting state**

Run:

```bash
git status --short --branch
sha256sum Decision_Safety_Network_PRD_Draft.md
```

Expected: branch `main`; only untracked `.DS_Store` files and this plan may appear; the PRD hash equals the Global Constraints value.

- [ ] **Step 2: Create the root agent contract**

Create `AGENTS.md` with these exact sections and rules:

```markdown
# Decision Safety Network — Agent Operating Contract

## Mission and authority

Build the AI Builder Cup Core MVP defined in `Decision_Safety_Network_PRD_Draft.md` without weakening its acceptance, trust, simulation, or scope boundaries. The PRD is locked unless the founder explicitly requests a change.

Authority order:
1. Direct user instructions.
2. The locked PRD for intended product behavior and acceptance.
3. Accepted records in `project/decisions/` for implementation rationale.
4. The assigned task record for bounded execution scope.
5. Code, configuration, and tests for actual implementation state.

## Required read order

Before writing, read this file and the assigned task. Every product-facing task also requires the PRD's AI Builder Cup executive brief, locked decisions, scope/proof boundary, Core MVP, and Cup-ready definition plus any additional sections referenced by the task. Read applicable implementation decisions, and read `project/WORKFLOW.md` before claiming or moving a task.

## Task ownership

- Do not begin implementation without a DSN task ID.
- Claim exactly one task by moving it to `project/tasks/in-progress/` and recording one owner, branch/worktree, owned paths, and start time.
- One active owner per task. No concurrent ownership of overlapping paths.
- Root configuration, schemas, lockfiles, this file, the PRD, and shared tracking files require serialized integrator ownership.
- If scope expands beyond declared paths, pause and coordinate before editing.

## Parallel development

- Use one task branch and isolated Git worktree per writing agent when work is concurrent.
- Inspect Git state before editing. Preserve unrelated changes.
- Never reset, discard, stash, amend, overwrite, or revert another agent's work.
- Workers do not merge their own task branch into `main`; the integrator reviews, verifies, and merges it.
- Make atomic commits whose subject begins with the task ID.

## Product and decision discipline

- Core MVP work precedes stretch work until every Cup-ready gate passes.
- Do not modify the locked PRD without explicit founder authorization.
- Record consequential architecture, API, data-contract, privacy/security, model, dependency, deployment, or interface choices in `project/decisions/`.
- Product-scope discoveries remain Proposed until founder approval.
- Never create an alternate task list, status file, memory file, decision log, or duplicated product summary.

## Verification and completion

- A file existing is not evidence that behavior works.
- Record commands, results, changed paths, limitations, and commit IDs in the task before review.
- Move a task to `done` only after its changes are integrated and applicable acceptance checks pass.
- `blocked` requires the blocker, evidence, next action, and owner of that action.
- `deferred` requires rationale, remaining risk, and an explicit resume condition.
- Report skipped or unavailable checks; never silently infer success.

## Safety and repository hygiene

- Use synthetic demo data only.
- Persistently label simulated bank, authority, reporting, and payment behavior as simulated.
- Never commit secrets, personal data, local credentials, generated build output, or environment files.
- Keep changes inside the assigned task and leave a complete handoff before stopping.
```

- [ ] **Step 3: Create the repository entry point**

Create `README.md` containing only:

```markdown
# Decision Safety Network

AI Builder Cup repository for the Decision Safety Network product.

## Start here

1. Read [`AGENTS.md`](AGENTS.md).
2. Read the relevant sections of [`Decision_Safety_Network_PRD_Draft.md`](Decision_Safety_Network_PRD_Draft.md).
3. Claim work through [`project/WORKFLOW.md`](project/WORKFLOW.md).
4. Consult accepted implementation decisions under [`project/decisions/`](project/decisions/).
5. Use [`SUBMISSION_PLAN.txt`](SUBMISSION_PLAN.txt) for deadline phases.

The PRD defines intended scope and acceptance. Code and tests define what currently works. Task records define ownership and execution state.
```

- [ ] **Step 4: Add the deadline reference file**

Create `SUBMISSION_PLAN.txt` with exactly these lines:

```text
AI BUILDER CUP — HIGH-LEVEL SUBMISSION PLAN

28–30 September: Finalize architecture, UX flows, ownership, and build plan.
1–7 October: Build the complete Core MVP vertical slice.
8–10 October: Integrate all surfaces and complete the end-to-end Safety Case.
11–12 October: Test against acceptance, security, accessibility, and failure criteria.
13–14 October: Fix defects, polish UX, and stabilize deployment.
15 October: Attempt stretch features only if the Core MVP is fully accepted.
16 October: Record the three-minute demo and finalize the presentation.
17 October: Run final submission QA and submit early.
18 October: Contingency only.
```

- [ ] **Step 5: Add stack-neutral repository hygiene**

Create `.gitignore` containing:

```gitignore
# Operating system and editors
.DS_Store
.idea/
.vscode/
*.swp

# Secrets and local configuration
.env
.env.*
!.env.example
*.pem
*.key

# Logs, coverage, and generated output
*.log
coverage/
dist/
build/
.cache/

# Common dependency and language caches
node_modules/
.venv/
venv/
__pycache__/
*.py[cod]
.pytest_cache/
```

Create `.editorconfig` containing:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 6: Verify navigation and policy coverage**

Run:

```bash
rg -n 'locked|one active owner|worktree|done|blocked|deferred|alternate task' AGENTS.md
rg -n 'AGENTS.md|Decision_Safety_Network_PRD_Draft.md|project/WORKFLOW.md|project/decisions' README.md
test "$(wc -l < SUBMISSION_PLAN.txt | tr -d ' ')" -eq 11
git check-ignore .DS_Store
```

Expected: every policy phrase appears, all navigation targets are named, the submission file has 11 lines, and `.DS_Store` is ignored.

- [ ] **Step 7: Commit Task 1**

```bash
git add AGENTS.md README.md SUBMISSION_PLAN.txt .gitignore .editorconfig
git commit -m "DSN-000: add repository operating rules"
```

Expected: one commit containing only the five Task 1 files.

---

### Task 2: Implement the repository-native work-item lifecycle

**Files:**
- Create: `project/WORKFLOW.md`
- Create: `project/tasks/TEMPLATE.md`
- Create: `project/tasks/backlog/.gitkeep`
- Create: `project/tasks/ready/.gitkeep`
- Create: `project/tasks/in-progress/.gitkeep`
- Create: `project/tasks/review/.gitkeep`
- Create: `project/tasks/blocked/.gitkeep`
- Create: `project/tasks/done/.gitkeep`
- Create: `project/tasks/deferred/.gitkeep`
- Create: `project/tasks/in-progress/DSN-000-repository-bootstrap.md`
- Create: `project/tasks/backlog/DSN-001-create-implementation-plan.md`

**Interfaces:**
- Consumes: task rules defined in `AGENTS.md`.
- Produces: the canonical task-state machine and two seeded work records.

- [ ] **Step 1: Create state directories**

Run:

```bash
mkdir -p project/tasks/{backlog,ready,in-progress,review,blocked,done,deferred}
```

Then use `apply_patch` to create `.gitkeep` in each state directory with the single line:

```text
# Keeps this task-state directory under Git.
```

Expected: seven state directories, each trackable before it contains a task.

- [ ] **Step 2: Write the workflow guide**

Create `project/WORKFLOW.md` with these sections and normative content:

```markdown
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
```

- [ ] **Step 3: Create the task template**

Create `project/tasks/TEMPLATE.md` containing:

```markdown
# DSN-NNN: Outcome-oriented title

- **Scope:** core | stretch | submission | infrastructure | defect
- **Priority:** P0 | P1 | P2
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** None until claimed
- **Dependencies:** None
- **PRD references:** Section or acceptance identifier
- **Decision references:** None
- **Started:** Not started
- **Last updated:** YYYY-MM-DD HH:MM TZ

## Outcome

One externally observable or independently verifiable result.

## Boundaries

- Included behavior
- Explicit exclusion

## Acceptance checks

- [ ] Observable acceptance condition with an exact command or review method

## Verification evidence

- **Commits:** None
- **Commands and results:** None
- **Changed paths:** None
- **Limitations or skipped checks:** None

## Blocker or deferral

Not applicable. If moved to `blocked` or `deferred`, record the reason, evidence, responsible party, next action or resume condition, and remaining risk.

## Handoff

- **Next action:** Prepare and claim this task.
- **Unresolved issues:** None recorded.
```

The template intentionally omits a Status field because directory placement is canonical.

- [ ] **Step 4: Seed the bootstrap record**

Create `project/tasks/in-progress/DSN-000-repository-bootstrap.md` containing:

```markdown
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
```

- [ ] **Step 5: Seed the next product task**

Create `project/tasks/backlog/DSN-001-create-implementation-plan.md` containing:

```markdown
# DSN-001: Create the Core MVP implementation plan

- **Scope:** core
- **Priority:** P0
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** None until claimed
- **Dependencies:** DSN-000
- **PRD references:** Core MVP feature set, causal acceptance matrix, canonical Cup state transitions, AI design and technical architecture, Cup acceptance criteria, and Cup-ready definition
- **Decision references:** None
- **Started:** Not started
- **Last updated:** 2026-09-28

## Outcome

Produce an owned, dependency-aware implementation plan and task decomposition for the complete Core MVP without changing the PRD.

## Boundaries

- Includes stack and architecture decisions, components, interfaces, ownership, dependency order, deployment path, and verification strategy.
- Excludes product implementation, stretch work, PRD revisions, and real institutional integrations.

## Acceptance checks

- [ ] Every Core MVP capability and Cup-ready gate maps to an implementation task.
- [ ] Every task declares exact file/module ownership and avoids overlapping concurrent paths.
- [ ] Component interfaces, event/state contracts, and dependency order are explicit.
- [ ] Every task includes executable verification commands and expected outcomes.
- [ ] The plan covers deployment, synthetic demo data, simulation labels, failure paths, security, accessibility, and evaluation.
- [ ] Work items are small enough for independent implementation, review, and integration.
- [ ] Stretch work remains outside the executable Core MVP sequence.

## Verification evidence

- **Commits:** None
- **Commands and results:** None
- **Changed paths:** None
- **Limitations or skipped checks:** None

## Blocker or deferral

Not applicable. Technology-stack and architecture choices must be approved before this task moves to `ready`.

## Handoff

- **Next action:** Move to `ready` after the technology stack and architecture are approved, then claim it in an isolated branch/worktree.
- **Unresolved issues:** Technology stack and implementation architecture are not selected yet.
```

- [ ] **Step 6: Verify lifecycle consistency**

Run:

```bash
find project/tasks -maxdepth 2 -type d | sort
rg -n '^## (Outcome|Boundaries|Acceptance checks|Verification evidence|Blocker or deferral|Handoff)$' project/tasks/TEMPLATE.md
if rg -n '^[-*] \*\*Status:\*\*|^status:' project/tasks; then exit 1; else echo 'PASS: directory-only status'; fi
rg -n 'one owner|owned paths|git mv|review|done|Blocked|Deferred|Core MVP|never operate both' project/WORKFLOW.md
```

Expected: all seven state directories exist, all six template sections appear, no duplicate status field exists, and the workflow contains every lifecycle safeguard.

- [ ] **Step 7: Commit Task 2**

```bash
git add project/WORKFLOW.md project/tasks
git commit -m "DSN-000: add repository task lifecycle"
```

Expected: one commit containing only workflow and task-tracking files.

---

### Task 3: Add implementation-decision and review controls

**Files:**
- Create: `project/decisions/README.md`
- Create: `project/decisions/TEMPLATE.md`
- Create: `.github/pull_request_template.md`

**Interfaces:**
- Consumes: authority and scope-change rules from `AGENTS.md` and task IDs from `project/tasks/`.
- Produces: durable decision rationale and a future PR review contract without creating a second tracker.

- [ ] **Step 1: Define the decision-record policy**

Create `project/decisions/README.md` containing:

```markdown
# Implementation Decision Records

The locked PRD is canonical for product and founder decisions; do not duplicate those decisions here.

Create `NNNN-short-title.md` only for consequential implementation choices involving architecture, interfaces, APIs, data contracts, privacy/security, model behavior, dependencies, deployment, or meaningful trade-offs future agents must understand.

Statuses are Proposed, Accepted, Rejected, and Superseded. Accepted records are immutable. A changed choice receives a new record and both records link through `Supersedes` / `Superseded by`.

A discovered product-scope change stays Proposed until the founder approves it. No decision record authorizes an agent to edit the PRD.

Use the next four-digit sequence number and `TEMPLATE.md`. Link the relevant DSN task, PRD section, implementation commit, and later superseding record.

If GitHub becomes canonical for tasks, decision records remain in the repository.
```

- [ ] **Step 2: Create the decision template**

Create `project/decisions/TEMPLATE.md` containing:

```markdown
# NNNN: Decision title

- **Status:** Proposed
- **Date:** YYYY-MM-DD
- **Owners:** Name or agent/task identifier
- **Related task:** DSN-NNN
- **PRD references:** Relevant sections
- **Supersedes:** None
- **Superseded by:** None

## Context

Describe the forces, constraints, evidence, and decision deadline.

## Decision

State the selected approach precisely.

## Consequences

- Positive consequence
- Cost, limitation, or follow-up obligation

## Alternatives considered

### Alternative name

Explain why it was not selected.

## Verification

Record the code, test, measurement, or review that will show the decision remains valid.
```

- [ ] **Step 3: Create the pull-request template**

Create `.github/pull_request_template.md` containing:

```markdown
## Task

- DSN task:
- PRD/decision references:

## Outcome

Describe the externally observable result, not the implementation activity.

## Scope

- Changed paths:
- Explicit exclusions:

## Acceptance and verification

- [ ] Task acceptance checks pass.
- [ ] Relevant automated tests/checks pass.
- [ ] Simulation boundaries remain explicit.
- [ ] Privacy, security, and accessibility implications were reviewed where applicable.

Commands and results:

## Risks and handoff

- Known limitations:
- Deferred work:
- Required follow-up:
```

- [ ] **Step 4: Verify decision and review boundaries**

Run:

```bash
rg -n 'do not duplicate|Accepted records are immutable|product-scope change|No decision record authorizes' project/decisions/README.md
rg -n '^## (Context|Decision|Consequences|Alternatives considered|Verification)$' project/decisions/TEMPLATE.md
rg -n '^## (Task|Outcome|Scope|Acceptance and verification|Risks and handoff)$' .github/pull_request_template.md
```

Expected: all authority, immutability, decision, acceptance, and handoff sections appear.

- [ ] **Step 5: Commit Task 3**

```bash
git add project/decisions .github/pull_request_template.md
git commit -m "DSN-000: add decision and review controls"
```

Expected: one commit containing only decision and review templates.

---

### Task 4: Audit and close the repository bootstrap

**Files:**
- Modify and move: `project/tasks/in-progress/DSN-000-repository-bootstrap.md` → `project/tasks/done/DSN-000-repository-bootstrap.md`
- Modify: `docs/superpowers/specs/2026-09-28-repository-operating-system-design.md`

**Interfaces:**
- Consumes: every file from Tasks 1–3.
- Produces: verified, clean repository baseline ready for DSN-001.

- [ ] **Step 1: Run the structural audit**

Run:

```bash
set -eu
test "$(git branch --show-current)" = "main"
test "$(sha256sum Decision_Safety_Network_PRD_Draft.md | cut -d' ' -f1)" = "548bdc6c81b908ff58daf654c0a6daaa29de1f4df0a1274f32128d4c6a7c712c"
for path in AGENTS.md README.md SUBMISSION_PLAN.txt .gitignore .editorconfig project/WORKFLOW.md project/tasks/TEMPLATE.md project/tasks/backlog/DSN-001-create-implementation-plan.md project/decisions/README.md project/decisions/TEMPLATE.md .github/pull_request_template.md; do test -f "$path"; done
test -f project/tasks/in-progress/DSN-000-repository-bootstrap.md || test -f project/tasks/done/DSN-000-repository-bootstrap.md
for state in backlog ready in-progress review blocked done deferred; do test -d "project/tasks/$state"; done
if rg -n '^[-*] \*\*Status:\*\*|^status:' project/tasks; then exit 1; fi
test "$(git log --oneline --grep '^DSN-000:' | wc -l | tr -d ' ')" -ge 3
echo 'PASS: repository structural audit'
```

Expected: `PASS: repository structural audit`.

- [ ] **Step 2: Record observed evidence**

Update `project/tasks/in-progress/DSN-000-repository-bootstrap.md` so every acceptance checkbox is checked and the evidence lists:

- the exact PRD SHA-256;
- `PASS: repository structural audit`;
- the three `DSN-000` commit subjects from `git log --oneline --grep '^DSN-000:'`;
- all created repository-control paths;
- no skipped checks or remaining bootstrap limitation.

Then move the verified record:

```bash
git mv project/tasks/in-progress/DSN-000-repository-bootstrap.md project/tasks/done/DSN-000-repository-bootstrap.md
```

- [ ] **Step 3: Mark the design implemented**

Change the design document header from:

```markdown
**Status:** Approved design; implementation pending
```

to:

```markdown
**Status:** Implemented
```

- [ ] **Step 4: Validate documentation and clean state before the final commit**

Run:

```bash
pandoc --fail-if-warnings -f gfm -t html AGENTS.md README.md project/WORKFLOW.md project/tasks/TEMPLATE.md project/tasks/done/DSN-000-repository-bootstrap.md project/tasks/backlog/DSN-001-create-implementation-plan.md project/decisions/README.md project/decisions/TEMPLATE.md docs/superpowers/specs/2026-09-28-repository-operating-system-design.md -o /tmp/dsn-repository-docs.html
for token in TB'D' TO'DO' FIX'ME' PLACE'HOLDER'; do if rg -n "$token" AGENTS.md README.md SUBMISSION_PLAN.txt project docs/superpowers/specs/2026-09-28-repository-operating-system-design.md; then exit 1; fi; done
git diff --check
```

Expected: Pandoc succeeds, placeholder scan produces no output, and `git diff --check` succeeds.

- [ ] **Step 5: Commit the verified bootstrap**

```bash
git add project/tasks/done/DSN-000-repository-bootstrap.md docs/superpowers/specs/2026-09-28-repository-operating-system-design.md
git commit -m "DSN-000: verify repository bootstrap"
```

- [ ] **Step 6: Run the final audit and inspect Git state**

Repeat the structural audit from Step 1, then run:

```bash
git status --short --branch
git log --oneline --decorate -6
```

Expected: structural audit passes; `## main` has no tracked or untracked entries because `.DS_Store` is ignored; the log shows the design baseline, this implementation plan, and four `DSN-000` scaffold commits.
