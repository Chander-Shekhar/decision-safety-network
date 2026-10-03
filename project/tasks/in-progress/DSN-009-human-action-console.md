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

- **Commits (on `task/DSN-009-human-action-console`, not yet merged):**
  - `eeebff6` DSN-009: add act() human decision commands and action routes
  - `4ad40f0` DSN-009: add ActionConsole human decision UI
- **Integration commit:** Not integrated - this branch has not been merged to `main`. Integrator must mount `createDecisionRoutes()` into `apps/api/src/app.ts` (deferred; see Handoff) before this is reachable from the real deployed API.
- **Commands and results:**
  - `JAVA_HOME=<local JDK21> PATH=$JAVA_HOME/bin:$PATH npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test -- decision.test.ts'` → 1 test file, **18/18 passed**.
  - Same emulator wrapper, `npm --workspace apps/api run test` (full suite) → 9 test files, **206/206 passed** (188 pre-existing baseline + 18 new `decision.test.ts`, confirming no regression).
  - `npm --workspace apps/web run test -- ActionConsole.test.tsx` → 1 test file, **16/16 passed**.
  - `npm --workspace apps/web run test` (full suite) → 5 test files, **57/57 passed** (41 pre-existing baseline + 16 new `ActionConsole.test.tsx`, confirming no regression).
  - `npm run typecheck` (root, all workspaces: `@dsn/contracts`, `@dsn/api`, `@dsn/web`) → clean, no errors.
  - `git diff --check` → clean (no output, exit 0).
  - `git status --porcelain` → only the four owned paths plus this task record changed.
- **Post-integration verification:** Not run (not integrated yet; owned by the integrator per `AGENTS.md`).
- **Changed paths:** `apps/api/src/decision-routes.ts` (new), `apps/api/test/decision.test.ts` (new), `apps/web/src/ActionConsole.tsx` (new), `apps/web/src/ActionConsole.test.tsx` (new), this task record.
- **Limitations or skipped checks:**
  - "Large" touch-target sizing is not implemented - this repo has no CSS/styling layer anywhere yet (matches `PaymentPanel.tsx`'s own unstyled precedent); only the functional keyboard-operability requirement (native `<button>`/`<input type="checkbox">` elements) is satisfied. A future styling pass owns actual visual sizing.
  - Route mounting into the shared public API (`apps/api/src/app.ts`) is a carry-forward, deliberately not done here: `app.ts` is serialized/integrator-owned. Tests build an isolated app via `buildApi([createDecisionRoutes()], deps)`, per the brief's explicit instruction. Flagging as a carry-forward for the integrator / DSN-014.
  - Added a `PAYMENT_FINALIZED` guard (409) in `act()` beyond the plan's illustrative snippet: once `paymentState` is `cancelled`/`continued`, every further action (including a second cancel/pause/verify) is rejected, mirroring `payment.ts`'s own existing guard vocabulary. `paused` is deliberately not treated as final (still cancellable/verifiable/continuable).
  - Added a `verifyPhase()` helper that chains `Observe->Check->Verify` as two legal hops inside one committed event, since `transitions.ts`'s `ALLOWED_TRANSITIONS` has no direct `Observe->Verify` pair - avoids an illegal direct jump for a quiet, un-joined case that asks to verify.
  - `DecisionAction` is a discriminated union requiring `key` + `expectedVersion` on every kind, rather than the plan's abbreviated illustrative snippet (which omitted `expectedVersion`) - this matches the existing idempotent-command convention used by `saveDraft`/`submitIntent` elsewhere in the codebase.
  - `ACK_REQUIRED` (400), `PAYMENT_FINALIZED` (409), and `ILLEGAL_TRANSITION` (409) are mapped in a local `LOCAL_ERROR_STATUS` map inside `decision-routes.ts`, mirroring `fact-routes.ts`'s pattern, since `app.ts`'s shared `STATUS_BY_ERROR_MESSAGE` is serialized and none of these three errors were already in it.
  - Verify-completion (DSN-010) and ally-grant (DSN-011) are out of scope here as directed; `ActionConsole`'s "Ask my ally" button only calls an injected `onAskAlly` callback with no local completion/drop state.

## Blocker or deferral

Not applicable - task complete within its owned scope, pending integrator review/merge.

## Handoff

- **Next action:** Integrator reviews branch `task/DSN-009-human-action-console`, mounts `createDecisionRoutes()` into `apps/api/src/app.ts` (DSN-014), merges to `main`, then re-runs the full suites post-integration and records that evidence here/in DSN-014.
- **Unresolved issues:** None. All items above are carry-forwards/deviations with stated reasoning, not open questions.
