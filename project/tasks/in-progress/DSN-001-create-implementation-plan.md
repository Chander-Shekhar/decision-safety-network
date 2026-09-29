# DSN-001: Create the Core MVP implementation plan

- **Scope:** core
- **Priority:** P0
- **Owner:** Primary agent (serialized integrator)
- **Branch/worktree:** `task/DSN-001-core-implementation-plan` / `.worktrees/dsn-001-core-implementation-plan`
- **Owned paths:** `.gitignore`, `docs/superpowers/specs/2026-09-30-core-mvp-technical-architecture-design.md`, `project/decisions/0001-google-cloud-typescript-architecture.md`, `docs/superpowers/plans/2026-09-30-core-mvp-implementation-plan.md`, and this task record; exact downstream task records will be declared before writing them
- **Dependencies:** DSN-000
- **PRD references:** Core MVP feature set, causal acceptance matrix, canonical Cup state transitions, AI design and technical architecture, Cup acceptance criteria, and Cup-ready definition
- **Decision references:** None
- **Started:** 2026-09-30
- **Last updated:** 2026-09-30

## Outcome

Produce an owned, dependency-aware implementation plan and task decomposition for the complete Core MVP without changing the PRD.

## Boundaries

- Includes stack and architecture decisions, components, interfaces, ownership, dependency order, deployment path, and verification strategy.
- Excludes product implementation, stretch work, PRD revisions, and real institutional integrations.

## Acceptance checks

- [ ] Every Core MVP capability and Cup-ready gate maps to an implementation task.
- [ ] The technology stack and implementation architecture are proposed, reviewed, approved, and captured in accepted decision records before dependent implementation tasks move to `ready`.
- [ ] Every task declares exact file/module ownership and avoids overlapping concurrent paths.
- [ ] Component interfaces, event/state contracts, and dependency order are explicit.
- [ ] Every task includes executable verification commands and expected outcomes.
- [ ] The plan covers deployment, synthetic demo data, simulation labels, failure paths, security, accessibility, and evaluation.
- [ ] Work items are small enough for independent implementation, review, and integration.
- [ ] Stretch work remains outside the executable Core MVP sequence.

## Verification evidence

- **Commits:** `872ea2e DSN-001: draft Core MVP technical architecture` and `6313910 DSN-001: require ally acceptance before disclosure` (local task branch); `f239c84 DSN-001: claim architecture and planning task` (local main)
- **Integration commit:** Not integrated
- **Commands and results:** `pandoc -f gfm -t html -o /dev/null` parsed the written spec; placeholder scan found no `TBD`/`TODO`/generic implementation steps; `git diff --cached --check` passed before both spec commits; locked PRD SHA-256 remained `548bdc6c81b908ff58daf654c0a6daaa29de1f4df0a1274f32128d4c6a7c712c`. Independent read-only review found and prompted fixes for pending transfer behavior, no-source-retention recovery, ally acceptance, recovery acknowledgements, and authorization/deletion details.
- **Post-integration verification:** Not run
- **Changed paths:** `.gitignore`, this task record, and `docs/superpowers/specs/2026-09-30-core-mvp-technical-architecture-design.md`.
- **Limitations or skipped checks:** The written spec awaits founder review; no implementation plan, accepted decision record, product code, or cloud resource was created. No remote push was made after the founder's instruction to keep work local.

## Blocker or deferral

Not applicable. The founder approved the all-TypeScript Google Cloud stack on 30 September. The written architecture specification still requires founder review before the detailed implementation plan is written; accepted decision records gate dependent tasks moving to `ready`.

## Handoff

- **Next action:** Ask the founder to review the committed written spec. Only after that approval, write the detailed implementation plan and accepted decision record; obtain separate consent before any remote push.
- **Unresolved issues:** Founder review of the server-only Firestore boundary, three retention choices (including the disclosed 24-hour confirmed-facts default), and non-settling simulated submit behavior. Exact implementation tasks await the plan; no product code is authorized yet.
