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
- **Last updated:** 2026-10-02

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

- **Commits:** `872ea2e DSN-001: draft Core MVP technical architecture`, `6313910 DSN-001: require ally acceptance before disclosure`, `5182272 DSN-001: separate ally preparation from case sharing`, `3278e01 DSN-001: finalize written architecture for founder review`, `0ee16fb DSN-001: approve architecture and draft Core MVP implementation plan`, `d3fa43e DSN-001: record plan review handoff` (local task branch); `f239c84 DSN-001: claim architecture and planning task` (local main); the acceptance-audit commit follows locally
- **Integration commit:** Not integrated
- **Commands and results:** `pandoc -f gfm -t html -o /dev/null` parsed the spec, accepted ADR, and plan; `git diff --cached --check` passed; placeholder scan found no `TBD`/`TODO`/generic DSN task IDs; locked PRD SHA-256 remained `548bdc6c81b908ff58daf654c0a6daaa29de1f4df0a1274f32128d4c6a7c712c`. Self-review mapped C1–C12 and every Cup-ready gate. Independent read-only reviews prompted fixes for owner-first idempotency, case creation/read, stale model/draft/consent results, retention/expiry cleanup, single close-route ownership, OIDC-vs-Firebase route authentication, combined resolution, explicit acceptance and UI checks for all 13 work packages, post-submit Gemini recheck, live-versus-fake Gemini testing, and confirmed-fact carry-through into recovery/export. Fresh verification of this audit is recorded below.
- **Acceptance audit:** A read-only reviewer and a structural check confirmed all 13 work packages have exact files, interfaces, two explicit acceptance gates, red/green verification commands, and expected results. The end-to-end journey now confirms caller-claim/payee/amount facts and asserts their same-case reuse and ZIP provenance; confirmation is explicitly not identity or claim verification. Demo-corpus safety thresholds and nonzero evaluation exits are pinned. Markdown parsing, `git diff --check`, task-structure check, placeholder scan, and locked-PRD checksum pass; no product tests exist yet to run.
- **Post-integration verification:** Not run
- **Changed paths:** `.gitignore`, this task record, `docs/superpowers/specs/2026-09-30-core-mvp-technical-architecture-design.md`, `project/decisions/0001-google-cloud-typescript-architecture.md`, and `docs/superpowers/plans/2026-10-02-core-mvp-implementation-plan.md`.
- **Limitations or skipped checks:** The plan awaits founder review and execution-method choice. No product code, runnable product tests, cloud resource, deployment, or remote push was created. Physical deletion after a scheduled cleanup failure is not instantaneous; the plan requires immediate logical expiry, authenticated sweep, TTL backup, monitoring, and honest copy.

## Blocker or deferral

Not applicable. The founder approved the all-TypeScript Google Cloud stack on 30 September and the three detailed architecture choices on 2 October. The implementation plan awaits founder review before dependent implementation tasks move to `ready`.

## Handoff

- **Next action:** Ask the founder to review the plan and select subagent-driven or native execution. After approval, create exact DSN-003 through DSN-015 task records and claim the first task. Obtain separate consent before any remote push.
- **Unresolved issues:** Founder review and execution approach; cloud project/billing authority before deployment. No product code is authorized yet.
