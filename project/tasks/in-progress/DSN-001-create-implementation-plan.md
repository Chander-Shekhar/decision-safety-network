# DSN-001: Create the Core MVP implementation plan

- **Scope:** core
- **Priority:** P0
- **Owner:** Primary agent (serialized integrator)
- **Branch/worktree:** `task/DSN-001-core-implementation-plan` / `.worktrees/dsn-001-core-implementation-plan`
- **Owned paths:** `.gitignore`, `docs/superpowers/specs/2026-09-30-core-mvp-technical-architecture-design.md`, `project/decisions/0001-google-cloud-typescript-architecture.md`, `docs/superpowers/plans/2026-10-02-core-mvp-implementation-plan.md`, and this task record; exact downstream task records will be declared before writing them
- **Dependencies:** DSN-000
- **PRD references:** Core MVP feature set, causal acceptance matrix, canonical Cup state transitions, AI design and technical architecture, Cup acceptance criteria, and Cup-ready definition
- **Decision references:** `project/decisions/0001-google-cloud-typescript-architecture.md` (Accepted, 2026-10-02)
- **Started:** 2026-09-30
- **Last updated:** 2026-10-03

## Outcome

Produce an owned, dependency-aware implementation plan and task decomposition for the complete Core MVP without changing the PRD.

## Boundaries

- Includes stack and architecture decisions, components, interfaces, ownership, dependency order, deployment path, and verification strategy.
- Excludes product implementation, stretch work, PRD revisions, and real institutional integrations.

## Acceptance checks

- [x] Every Core MVP capability and Cup-ready gate maps to an implementation task.
- [x] The technology stack and implementation architecture are proposed, reviewed, approved, and captured in accepted decision records before dependent implementation tasks move to `ready`.
- [x] Every task declares exact file/module ownership and avoids overlapping concurrent paths.
- [x] Component interfaces, event/state contracts, and dependency order are explicit.
- [x] Every task includes executable verification commands and expected outcomes.
- [x] The plan covers deployment, synthetic demo data, simulation labels, failure paths, security, accessibility, and evaluation.
- [x] Work items are small enough for independent implementation, review, and integration.
- [x] Stretch work remains outside the executable Core MVP sequence.
- [ ] The founder reviews the detailed plan and confirms the execution approach before implementation begins.

## Verification evidence

- **Commits:** `872ea2e` architecture draft; `6313910` ally acceptance; `5182272` ally preparation/disclosure separation; `3278e01` architecture review; `0ee16fb` implementation plan; `d3fa43e` plan-review handoff; `5d4ecb7` task acceptance audit; `58de29b` alignment with approved wireframes (task branch). `f239c84` claimed the task on local main. This record's publication handoff is a subsequent local commit.
- **Integration commit:** Not integrated
- **Commands and results:** `pandoc -f gfm -t html -o /dev/null` parsed the spec, accepted ADR, and plan; `git diff --cached --check` passed; placeholder scan found no `TBD`/`TODO`/generic DSN task IDs; locked PRD SHA-256 remained `548bdc6c81b908ff58daf654c0a6daaa29de1f4df0a1274f32128d4c6a7c712c`. Self-review mapped C1–C12 and every Cup-ready gate. Independent read-only reviews prompted fixes for owner-first idempotency, case creation/read, stale model/draft/consent results, retention/expiry cleanup, single close-route ownership, OIDC-vs-Firebase route authentication, combined resolution, explicit acceptance and UI checks for all 13 work packages, post-submit Gemini recheck, live-versus-fake Gemini testing, and confirmed-fact carry-through into recovery/export. Fresh verification of this audit is recorded below.
- **Acceptance audit:** A read-only reviewer and a structural check confirmed all 13 work packages have exact files, interfaces, two explicit acceptance gates, red/green verification commands, and expected results. The end-to-end journey now confirms caller-claim/payee/amount facts and asserts their same-case reuse and ZIP provenance; confirmation is explicitly not identity or claim verification. Demo-corpus safety thresholds and nonzero evaluation exits are pinned. Markdown parsing, `git diff --check`, task-structure check, placeholder scan, and locked-PRD checksum pass; no product tests exist yet to run.
- **Wireframe alignment:** On 3 October, the founder approved the Core MVP wireframes. `58de29b` reconciled the plan before publication: Ask My Ally previews an exact frozen packet and requires a separate Share; changed packet content invalidates access; recovery distinguishes proposed from actual-paid details, binds one-tap match to the exact prefill, and only exports user-reported paid facts after confirmation. `pandoc` parsing and `git diff --check` passed; an independent read-only review found no remaining material mismatch.
- **Post-integration verification:** Not run
- **Changed paths:** This task record, `docs/superpowers/specs/2026-09-30-core-mvp-technical-architecture-design.md`, `project/decisions/0001-google-cloud-typescript-architecture.md`, and `docs/superpowers/plans/2026-10-02-core-mvp-implementation-plan.md`. The task claim previously added `.worktrees/` to `.gitignore` on main.
- **Limitations or skipped checks:** The detailed plan still awaits founder review and execution-method choice; wireframe approval is not plan approval. No product code, runnable product tests, cloud resource, or deployment was created. Physical deletion after a scheduled cleanup failure is not instantaneous; the plan requires immediate logical expiry, authenticated sweep, TTL backup, monitoring, and honest copy.

## Blocker or deferral

Not applicable. The founder approved the all-TypeScript Google Cloud stack on 30 September, the three detailed architecture choices on 2 October, and the UI wireframes on 3 October. The detailed implementation plan still awaits founder review before dependent implementation tasks move to `ready`.

## Handoff

- **Next action:** Publish this branch to the personal GitHub repository under the founder's 3 October authorization, then ask for detailed-plan review and execution-method choice. After approval, create exact DSN-003 through DSN-015 task records and claim the first task.
- **Unresolved issues:** Detailed-plan review and execution approach; cloud project/billing authority before deployment. No product code is authorized yet.
