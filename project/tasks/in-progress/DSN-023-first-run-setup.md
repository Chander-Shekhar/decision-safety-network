# DSN-023: First-run setup flow

- **Scope:** core
- **Priority:** P1
- **Owner:** Orchestrator (subagent-driven implementer under integrator)
- **Branch/worktree:** `task/DSN-023-first-run-setup` (isolated worktree)
- **Owned paths:** `apps/web/src/**`, `apps/api/src/plan*`, `packages/contracts/src/plan.ts`. Serialized/not owned: no session/screening/recovery/ally modules.
- **Dependencies:** DSN-022 (design system) — integrated at `1bfd4d2`.
- **PRD references:** Part I — C1 Decision Safety Plan; Fixed scope; three-minute demo beat 0:00
- **Decision references:** 0010
- **Started:** 2026-10-11
- **Last updated:** 2026-10-11

## Outcome

A guided first-run setup a new user completes and lands configured on home: (1) call-listening preference — all calls / unverified numbers only / decide per call at pickup; (2) ally + what case info to share; (3) bank account(s) registered for later guided protection. Extends the existing plan model/contract.

## Boundaries

- Included: home/empty state, setup steps, persistence through the plan API, "configured home" landing.
- Excluded: the actual call capture (DSN-025), caller screening (DSN-024), real bank linking (guided only, DSN-027).

## Acceptance checks

- [ ] A fresh user with no plan is routed into setup; completing it persists the preferences and lands on a configured home.
- [ ] Call-listening preference persists and is readable by the screening/session flow.
- [ ] Web + API suites green; typecheck clean; contract change (if any) is additive and versioned.

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

- **Next action:** Prepare and claim after DSN-022 lands the design system.
- **Unresolved issues:** None recorded.
