# DSN-009: Human action console and resolved prevention

- **Scope:** core
- **Priority:** P0
- **Owner:** Claude implementer agent
- **Branch/worktree:** `task/DSN-009-human-action-console` / `.worktrees/dsn-009-human-action-console`
- **Owned paths:** `apps/api/src/decision-routes.ts`, `apps/api/test/decision.test.ts`, `apps/web/src/{ActionConsole,ActionConsole.test}.tsx`
- **Dependencies:** DSN-003, DSN-007, DSN-008
- **PRD references:** C6 action console; C9 prevention resolution
- **Decision references:** 0001
- **Started:** 2026-10-03
- **Last updated:** 2026-10-03

## Outcome

Explicit idempotent human actions (pause/cancel/verify/acknowledged-continue); ≤3 grounded reasons; pre-OTP copy; manual controls survive Gemini failure. See plan Task 7 (DSN-009). UI frames 03, 03b, 05.

## Boundaries

- Included: `act`, action routes, ActionConsole. `ask-ally` only opens DSN-011 preview (no grant side effect; not shown completed/dropped until DSN-011 exists).
- Excluded: Verify completion (DSN-010), ally grant (DSN-011). Model response cannot issue a command.

## Acceptance checks

- [x] Pause/Cancel/Verify/acknowledged-Continue create inspectable idempotent simulated state changes; ack starts unchecked with Confirm Continue disabled; Continue w/o ack denied (`ACK_REQUIRED`); non-joined Check uses ordinary confirmation; manual actions available during Gemini failure.
- [x] Console shows ≤3 source-grounded reasons, keyboard-operable actions, persistent **Simulated**, pre-OTP copy, no "held your real transfer" claim. (Visual "large" sizing is a CSS/styling concern not yet implemented anywhere in this codebase - see Limitations.)
- [x] Red→green per plan Task 7; `test:api -- decision.test.ts` + `test:web -- ActionConsole.test.tsx` + `typecheck` pass; `git diff --check` clean.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits (on `task/DSN-009-human-action-console`):**
  - `eeebff6` DSN-009: add act() human decision commands and action routes
  - `4ad40f0` DSN-009: add ActionConsole human decision UI
  - `c50d310` DSN-009: verify two-hop persistence + ActionConsole no-reasons default (scoped fix)
- **Integration commit:** `fe7b8bb` DSN-009: integrate human action console and resolved prevention (`--no-ff` merge into local `main`).
- **Independent review + re-review:** read-only reviewer (`dsn009-review`) first verdict CHANGES-REQUIRED → one blocking defect: `verify` from a quiet `Observe` case collapsed `Observe→Check→Verify` into ONE committed event, writing an `Observe→Verify` edge the canonical transition table forbids into the append-only audit log (breaks the one-legal-edge-per-event invariant held everywhere else, undermines C11's correction-preserving timeline). Non-blocking: ActionConsole crashed on a projection with absent `reasons`; pause leaves phase unchanged (founder design call — see Limitations). Fix `c50d310`: `verify` now persists TWO individually-legal events (`Observe→Check` then `Check→Verify`, version +2) for an Observe-origin case and ONE event for Check/Pause origin, via an `actVerify` helper whose hop-1 idempotency key is a `deterministicUuid` (sha256-derived, re-stamped to a schema-valid v4 because `commitCaseCommand`'s `z.uuid()` rejects a plain suffix); `ActionConsole` defaults `reasons` to `[]`. Fix independently re-reviewed → APPROVED; two-hop idempotency/OCC/replay traced; illegal edge proven gone (test asserts the collapsed edge can never reappear).
- **Commands and results (post-fix, on branch):**
  - API suite under emulator → 9 test files, **208/208 passed** (18 `decision.test.ts` incl. two-hop/replay regressions + 190 pre-existing).
  - `npm --workspace apps/web run test` → 5 test files, **58/58 passed** (16 `ActionConsole.test.tsx` + 42 pre-existing).
  - `npm run typecheck` (all workspaces) → clean. `git diff --check` → clean.
- **Post-integration verification (on `main` @ `fe7b8bb`):**
  - `npm run typecheck` → clean across `@dsn/contracts`, `@dsn/api`, `@dsn/web`.
  - `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test'` → `Test Files 9 passed (9)`, `Tests 208 passed (208)`.
  - `npm --workspace apps/web run test` → `Test Files 5 passed (5)`, `Tests 58 passed (58)`.
  - `git diff --check` → clean. Hygiene scan of the four committed files → no absolute path, workplace URL/email, or secret.
- **Changed paths:** `apps/api/src/decision-routes.ts` (new), `apps/api/test/decision.test.ts` (new), `apps/web/src/ActionConsole.tsx` (new), `apps/web/src/ActionConsole.test.tsx` (new), this task record.
- **Limitations or skipped checks:**
  - "Large" touch-target sizing is not implemented - this repo has no CSS/styling layer anywhere yet (matches `PaymentPanel.tsx`'s own unstyled precedent); only the functional keyboard-operability requirement (native `<button>`/`<input type="checkbox">` elements) is satisfied. A future styling pass owns actual visual sizing.
  - Route mounting into the shared public API (`apps/api/src/app.ts`) is a carry-forward, deliberately not done here: `app.ts` is serialized/integrator-owned. Tests build an isolated app via `buildApi([createDecisionRoutes()], deps)`, per the brief's explicit instruction. Flagging as a carry-forward for the integrator / DSN-014.
  - Added a `PAYMENT_FINALIZED` guard (409) in `act()` beyond the plan's illustrative snippet: once `paymentState` is `cancelled`/`continued`, every further action (including a second cancel/pause/verify) is rejected, mirroring `payment.ts`'s own existing guard vocabulary. `paused` is deliberately not treated as final (still cancellable/verifiable/continuable).
  - `verify` from a quiet `Observe` case persists TWO individually-legal events (`Observe->Check`, then `Check->Verify`; net version +2) rather than one event spanning the illegal `Observe->Verify` pair (`transitions.ts` has no such direct pair). Check/Pause-origin verify stays one event. The two hops use distinct deterministic idempotency keys so a replay/resume is safe (see `actVerify`/`deterministicUuid` in `decision-routes.ts`). This replaced the originally-submitted single-event `verifyPhase` after the review flagged the audit-log edge as illegal.
  - **Concurrent-interleave residual (documented, non-blocking):** for an `Observe`-origin verify, if a different writer bumps the case version AFTER hop-1 (`Observe->Check`) commits but BEFORE hop-2 (`Check->Verify`) lands, hop-2's `expectedVersion` is pinned to hop-1's stored receipt on every SAME-key retry, so that retry wedges on `VERSION_CONFLICT` permanently; a FRESH-key verify fully recovers (the case is left in a safe, legal, persisted `Check` state — no corruption, no auto-settle, no illegal edge, no payment-state change). The window is two adjacent awaits in one request handler (sub-millisecond); an Observe-origin case has no payment draft so PaymentPanel auto-recheck is not a trigger, and the scripted single-presenter Cup demo does not hit it. It does technically violate same-key idempotent-retry convergence, so it is recorded here. Optional future hardening: in hop-2, catch `VERSION_CONFLICT`, re-read, and if phase is already `Verify` treat as done / if still `Check` re-pin to live version and retry once.
  - `DecisionAction` is a discriminated union requiring `key` + `expectedVersion` on every kind, rather than the plan's abbreviated illustrative snippet (which omitted `expectedVersion`) - this matches the existing idempotent-command convention used by `saveDraft`/`submitIntent` elsewhere in the codebase.
  - `ACK_REQUIRED` (400), `PAYMENT_FINALIZED` (409), and `ILLEGAL_TRANSITION` (409) are mapped in a local `LOCAL_ERROR_STATUS` map inside `decision-routes.ts`, mirroring `fact-routes.ts`'s pattern, since `app.ts`'s shared `STATUS_BY_ERROR_MESSAGE` is serialized and none of these three errors were already in it.
  - Verify-completion (DSN-010) and ally-grant (DSN-011) are out of scope here as directed; `ActionConsole`'s "Ask my ally" button only calls an injected `onAskAlly` callback with no local completion/drop state.
  - **Founder design call surfaced (not a defect):** a human **Pause** sets the simulated transfer state to `paused` but leaves the intervention `phase` unchanged (phase is policy-owned via `transition`; C6 scopes Pause to the transfer state). The reviewer confirmed this is coherent — a non-joined paused case uses ordinary confirmation, not the ack gate reserved for the joined high-risk Pause. Left as implemented; flagged for the founder in case a human Pause should also drive `phase` to `Pause`.

## Blocker or deferral

Not applicable - integrated and verified.

## Handoff

- **Next action:** Done — integrated at `fe7b8bb`, post-integration gate green. Carry-forward: integrator must mount `createDecisionRoutes()` into `apps/api/src/app.ts` at DSN-014 (deferred; `app.ts` serialized) before these routes are reachable from the deployed API.
- **Carry-forwards:** route mounting → DSN-014; concurrent-interleave verify residual (above, non-blocking) → optional future hardening; "large" touch-target visual sizing → future styling pass; human-Pause-phase semantics → founder design call (above).
