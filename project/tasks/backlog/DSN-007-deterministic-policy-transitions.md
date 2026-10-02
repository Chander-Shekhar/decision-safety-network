# DSN-007: Versioned deterministic policy and legal transitions

- **Scope:** core
- **Priority:** P0
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** `apps/api/src/{policy,transitions}.ts`, `apps/api/test/{policy,transitions}.test.ts`
- **Dependencies:** DSN-003, DSN-006
- **PRD references:** C5 state orchestrator; four-row causal matrix
- **Decision references:** 0001
- **Started:** Not started
- **Last updated:** 2026-10-03

## Outcome

Deterministic versioned `assessCase` + legal `transition` state machine; joined Pause requires validated matching relation, not amount/conversation alone. See plan Task 5 (DSN-007).

## Boundaries

- Included: `assessCase`, `transition`, `GroundedReason`, `POLICY_VERSION`, allowed-transition table.
- Excluded: payment binding (DSN-008), action commands (DSN-009). No model text selects an action.

## Acceptance checks

- [ ] Four PRD causal-matrix rows return proportionate behavior incl. correction rollback; conversation-only, payment-only, legitimate pressure never cause joined Pause.
- [ ] Every allowed transition works; every prohibited pair throws `ILLEGAL_TRANSITION`; ≤3 grounded reasons with valid sources; model text cannot select action.
- [ ] Red→green per plan Task 5; `test:api -- policy.test.ts transitions.test.ts` + `typecheck` pass; `git diff --check` clean.

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

- **Next action:** Blocked on DSN-006 integration.
- **Unresolved issues:** None recorded.
