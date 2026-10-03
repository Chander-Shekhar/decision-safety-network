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

- **Commits:**
  - `e47407b54ba9ec66139493bfd532fb458bdbd0f9` — "DSN-007: add deterministic decision policy and legal transitions" (branch `task/DSN-007-deterministic-policy-transitions`).
  - `2b122c4` — "DSN-007: record verification evidence for policy/transitions implementation" (task-record-only).
  - `e03049c` — "DSN-007: ground correction-rollback reason, stop overclaiming a prior join" — scoped fix from independent review (verdict CHANGES-REQUIRED, one MEDIUM defect; everything else APPROVED). Touches only `apps/api/src/policy.ts` and `apps/api/test/policy.test.ts`; `transitions.ts`/`transitions.test.ts` were approved as-is and were not touched.
- **Integration commit:** `e9f9aea` — `DSN-007: integrate deterministic policy and legal transitions` (merged `task/DSN-007-...` into local `main` with `--no-ff` after an independent read-only review returned APPROVED on the scoped correction-rollback fix `504b097`). Non-blocking residual carried from the review (NOT a DSN-007 defect): `manipulation-cues`/`unverified-claim` still cite `input.sourceSegmentIds ?? []`, so a caller that omits `sourceSegmentIds` could emit those two ungrounded (empty array) — pre-existing, relies on the DSN-009 caller contract; carried forward to DSN-009.
- **Commands and results:**
  - Red (before implementation): `npm run test:api -- policy.test.ts transitions.test.ts` → both suites failed with `Cannot find module '../src/policy.js'` / `'../src/transitions.js'` (expected: modules did not exist yet).
  - Green (after initial implementation): `npm run test:api -- policy.test.ts transitions.test.ts` → `Test Files 2 passed (2)`, `Tests 66 passed (66)`.
  - `npm run typecheck` (initial) → clean across all three workspaces (`@dsn/contracts`, `@dsn/api`, `@dsn/web`), no errors.
  - `git diff --cached --check` (initial, after `git add` of the four new files) → exit 0, no whitespace errors.
  - Green (after the correction-rollback fix): `npm run test:api -- policy.test.ts transitions.test.ts` → `Test Files 2 passed (2)`, `Tests 70 passed (70)` (4 new policy.test.ts cases: grounded fallback via `sourceSegmentIds`, no-prior-join wording + `correctionEventId` citation, ungrounded-reason omission across the full boolean sweep, and the all-combinations sweep extended to assert every emitted reason is grounded).
  - `npm run typecheck` (after the fix) → clean across all three workspaces, no errors.
  - `git diff --cached --check` (after the fix, `git add` of `apps/api/src/policy.ts` + `apps/api/test/policy.test.ts` only) → exit 0, no whitespace errors.
  - `git status --short` confirmed only `apps/api/src/policy.ts` and `apps/api/test/policy.test.ts` were modified for the fix; no serialized/shared file touched.
- **Changed paths:** `apps/api/src/policy.ts` (new, then fixed), `apps/api/src/transitions.ts` (new, unchanged by the fix), `apps/api/test/policy.test.ts` (new, then extended, 70 cases), `apps/api/test/transitions.test.ts` (new, unchanged by the fix; exhaustively asserts every allowed pair in the PRD's 6-phase table succeeds and every other of the 36 pairs — including self-transitions — throws `ILLEGAL_TRANSITION`, plus `model`/`model-timeout`/`user-override`/`correction-rollback`/empty-string `cause` values never changing legality).
- **PRD-vs-plan reconciliation:** None needed. The plan's `allowed` transition table (docs/superpowers/plans/.../Task 5) is byte-for-byte identical to the PRD's "Canonical Cup state transitions" table; `transitions.test.ts` asserts against a copy of the PRD table directly (not against the implementation) to catch any future drift.
- **Design decisions beyond the plan's literal snippet (no scope change):**
  - `GroundedReason`/`ReasonCode` enum lives in `policy.ts` (not a new `packages/contracts` file) since no contracts file was in this task's owned paths.
  - Four reason codes defined: `manipulation-cues`, `unverified-claim`, `large-new-payee`, `correction-rollback`. `large-new-payee` is emitted only when `isJoined` is true (i.e. only alongside a validated `matchingRelation`), so an unrelated large payment is never cited as a reason next to unrelated conversation cues — this directly protects the row-2/row-1 "do not claim conversation risk/payment risk exists" boundary for non-joined cases.
  - A correction (`corrected: true`) always forces `isJoined` to false (checked first) and always yields phase `'Check'`, regardless of which other flags are set — this is what makes an owner correction retract an *active* joined Pause, not just prevent one.
  - `AssessCaseInput` has no free-text or action-selecting field at all (only booleans, an optional `corrected` flag, and reference arrays `sourceSegmentIds`/`paymentEventId`/`correctionEventId`), so "model text cannot select an action" is enforced structurally by the type, not just by convention; verified at runtime with a test that casts a hostile object with extra `phase`/`action`/`text` fields through `AssessCaseInput` and confirms they have zero effect.
  - **Correction-rollback grounding fix (`e03049c`):** the policy is stateless and has no record of what, if anything, was previously joined, so the `correction-rollback` reason's fixed text was reworded to assert only "an owner correction was applied... re-checked as a result" — never a prior join. Added `AssessCaseInput.correctionEventId?: string` (mirrors the existing `paymentEventId` precedent) as the honest primary reference, since a correction itself is not transcript-sourced (DSN-006's `correctFact`/`confirmFact` record `sourceSegmentIds: []` for the correction event); `sourceSegmentIds` remains an accepted fallback reference if the caller supplies one (e.g. citing the original claim that was corrected). If neither reference is present, the `correction-rollback` reason is omitted entirely rather than asserted ungrounded — the `Check` phase rollback itself is unaffected either way, since phase selection never depended on reason grounding. Caller contract (for DSN-009): pass `correctionEventId` whenever `corrected` is true.
- **Limitations or skipped checks:** None. No emulator was started by the worker (not needed — both modules are pure; confirmed no Firestore/network/`@google/genai` import in either file).
- **Post-integration verification:** On integrated `main` @ `e9f9aea` (JDK 21 for the shell only; path never written to any committed file; `--project demo-dsn`): `npm run typecheck` → exit 0 across all three workspaces; `npx firebase emulators:exec --only auth,firestore 'npm run test:api'` → **163 passed (163)**, 7 test files (prior 93 + DSN-007's 70; no regression anywhere), script exited 0; `git diff --check fa34bb7 e9f9aea` → clean. (Benign offline `MetadataLookupWarning`; the global-npm `always-auth`/`repo.local.sfdc.net` warning is the user's machine-level config, not the project `.npmrc`, and is not committed.)

## Blocker or deferral

Not applicable — integrated and verified on local `main`.

## Handoff

- **Next action:** Done. No further action on this task.
- **Carry-forward for consumers (not DSN-007 defects):**
  - **DSN-009:** `assessCase`/`transition` are pure and intentionally unconsumed by any route here. DSN-009 must (a) route every phase change through `transition` (the only legal path; `Observe→Pause` is illegal — go via `Check`), (b) persist `POLICY_VERSION` + reason codes on the policy-driven `CaseEvent` (never model-authored action text), and (c) pass `correctionEventId` whenever `corrected` is true, and pass `sourceSegmentIds` backing `cues`/`unverified` so `manipulation-cues`/`unverified-claim` are never emitted ungrounded (the non-blocking residual above).
  - **DSN-008:** supplies the validated `matchingRelation` and `largeNewPayee` booleans (validated against the current payment draft + case version) and the `paymentEventId` backing `large-new-payee`.
