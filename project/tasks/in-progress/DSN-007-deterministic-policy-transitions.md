# DSN-007: Versioned deterministic policy and legal transitions

- **Scope:** core
- **Priority:** P0
- **Owner:** DSN-007 implementer subagent (serialized under integrator)
- **Branch/worktree:** `task/DSN-007-deterministic-policy-transitions` @ `.worktrees/dsn-007-deterministic-policy-transitions`
- **Owned paths:** `apps/api/src/{policy,transitions}.ts`, `apps/api/test/{policy,transitions}.test.ts`
- **Dependencies:** DSN-003 (done @ e560d2d), DSN-006 (done @ 057626d)
- **PRD references:** C5 state orchestrator; four-row causal matrix
- **Decision references:** 0001
- **Started:** 2026-10-03

## Outcome

Deterministic versioned `assessCase` + legal `transition` state machine; joined Pause requires validated matching relation, not amount/conversation alone. See plan Task 5 (DSN-007).

## Boundaries

- Included: `assessCase`, `transition`, `GroundedReason`, `POLICY_VERSION`, allowed-transition table.
- Excluded: payment binding (DSN-008), action commands (DSN-009). No model text selects an action.

## Acceptance checks

- [x] Four PRD causal-matrix rows return proportionate behavior incl. correction rollback; conversation-only, payment-only, legitimate pressure never cause joined Pause.
- [x] Every allowed transition works; every prohibited pair throws `ILLEGAL_TRANSITION`; ≤3 grounded reasons with valid sources; model text cannot select action.
- [x] Red→green per plan Task 5; `test:api -- policy.test.ts transitions.test.ts` + `typecheck` pass; `git diff --check` clean.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits:** `e47407b54ba9ec66139493bfd532fb458bdbd0f9` — "DSN-007: add deterministic decision policy and legal transitions" (branch `task/DSN-007-deterministic-policy-transitions`).
- **Integration commit:** Not integrated (worker does not merge own branch; integrator reviews and merges per AGENTS.md).
- **Commands and results:**
  - Red (before implementation): `npm run test:api -- policy.test.ts transitions.test.ts` → both suites failed with `Cannot find module '../src/policy.js'` / `'../src/transitions.js'` (expected: modules did not exist yet).
  - Green (after implementation): `npm run test:api -- policy.test.ts transitions.test.ts` → `Test Files 2 passed (2)`, `Tests 66 passed (66)`.
  - `npm run typecheck` → clean across all three workspaces (`@dsn/contracts`, `@dsn/api`, `@dsn/web`), no errors.
  - `git diff --cached --check` (after `git add` of the four new files) → exit 0, no whitespace errors.
- **Changed paths:** `apps/api/src/policy.ts` (new), `apps/api/src/transitions.ts` (new), `apps/api/test/policy.test.ts` (new, 66 cases incl. the four literal matrix rows, correction rollback, legitimate-high-pressure control, conversation-only, payment-only, ≤3-reasons/valid-reference checks, and a hostile-input test proving extraneous action/phase/text fields on the input are structurally ignored), `apps/api/test/transitions.test.ts` (new; exhaustively asserts every allowed pair in the PRD's 6-phase table succeeds and every other of the 36 pairs — including self-transitions — throws `ILLEGAL_TRANSITION`, plus `model`/`model-timeout`/`user-override`/`correction-rollback`/empty-string `cause` values never changing legality).
- **PRD-vs-plan reconciliation:** None needed. The plan's `allowed` transition table (docs/superpowers/plans/.../Task 5) is byte-for-byte identical to the PRD's "Canonical Cup state transitions" table; `transitions.test.ts` asserts against a copy of the PRD table directly (not against the implementation) to catch any future drift.
- **Design decisions beyond the plan's literal snippet (no scope change):**
  - `GroundedReason`/`ReasonCode` enum lives in `policy.ts` (not a new `packages/contracts` file) since no contracts file was in this task's owned paths.
  - Four reason codes defined: `manipulation-cues`, `unverified-claim`, `large-new-payee`, `correction-rollback`. `large-new-payee` is emitted only when `isJoined` is true (i.e. only alongside a validated `matchingRelation`), so an unrelated large payment is never cited as a reason next to unrelated conversation cues — this directly protects the row-2/row-1 "do not claim conversation risk/payment risk exists" boundary for non-joined cases.
  - A correction (`corrected: true`) always forces `isJoined` to false (checked first) and always yields phase `'Check'`, regardless of which other flags are set — this is what makes an owner correction retract an *active* joined Pause, not just prevent one.
  - `AssessCaseInput` has no free-text or action-selecting field at all (only booleans, an optional `corrected` flag, and reference arrays `sourceSegmentIds`/`paymentEventId`), so "model text cannot select an action" is enforced structurally by the type, not just by convention; verified at runtime with a test that casts a hostile object with extra `phase`/`action`/`text` fields through `AssessCaseInput` and confirms they have zero effect.
- **Limitations or skipped checks:** None. No emulator was started (not needed — both modules are pure; confirmed no Firestore/network/`@google/genai` import in either file).

## Blocker or deferral

Not applicable — not blocked; DSN-006 was integrated at `057626d` before this task started (see Dependencies above).

## Handoff

- **Next action:** Integrator reviews and merges `task/DSN-007-deterministic-policy-transitions` (commit `e47407b54ba9ec66139493bfd532fb458bdbd0f9`) into `main`, then runs post-integration verification and moves this task to `done`.
- **Unresolved issues:** None recorded. `assessCase`/`transition` are intentionally unconsumed by any route in this task (DSN-008/DSN-009's job per Boundaries above); nothing in this task's scope wires them in.
