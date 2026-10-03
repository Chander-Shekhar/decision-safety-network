# DSN-012: Instant same-case already-paid recovery

- **Scope:** core
- **Priority:** P0
- **Owner:** DSN-012 implementer subagent (serialized under integrator)
- **Branch/worktree:** `task/DSN-012-same-case-recovery` @ `.worktrees/dsn-012-same-case-recovery`
- **Owned paths:** `packages/contracts/src/recovery.ts`, `apps/api/src/{recovery,recovery-routes}.ts`, `apps/api/test/recovery.test.ts`, `apps/web/src/{RecoveryScreen,RecoveryScreen.test}.tsx`
- **Dependencies:** DSN-009 (done @ fe7b8bb); DSN-013 retention/source-expiry (done @ f9e3e90); also Task 6 PaymentDraft @ 611f85b
- **PRD references:** C10 same-case recovery
- **Decision references:** 0001
- **Started:** 2026-10-04
- **Last updated:** 2026-10-04

## Outcome

"I already paid" enters Recover on same case from any state, reuses confirmed facts as labeled prefill, offers Demo Bank + real 1930 in parallel, works with Gemini down; paid fields set only by explicit user match/edit. See plan Task 10 (DSN-012). UI frame 06.

## Boundaries

- Included: `RecoveryState`/`PaidPayment`/`RecoveryProjection`, `enterRecovery`, `confirmPaidDetails` (match/edit, fingerprinted), parallel bank/1930 actions, RecoveryScreen.
- Excluded: evidence/retention internals (DSN-013). No Gemini call to enter recovery. Simulated acknowledgements labeled; real 1930 route (source URL + review date) not badged fictional.

## Acceptance checks

- [x] `already-paid` enters Recover from Observe/Check/Pause/Verify/Resolve same case ID; reuses confirmed facts as labeled context; prompts only unknown harm-routing fields; works Gemini-unavailable; proposed ≠ paid until explicit match/edit; `STALE_PREFILL` rejected; cancelled proposal not proof.
- [x] First screen gives Demo Bank + source-dated 1930 equal priority; labels only local acknowledgements **Simulated**; warns recovery scams; default-retention `source not retained` copy.
- [x] Red→green per plan Task 10; `test:api -- recovery.test.ts` + `test:web -- RecoveryScreen.test.tsx` + `typecheck` pass; `git diff --check` clean.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits (branch `task/DSN-012-same-case-recovery`, local only):** `4bb3f45` red API tests + contract; `5731b29` API implementation; red web tests (between); `655f4e6` RecoveryScreen.
- **Integration commit:** Not integrated
- **Commands and results:**
  - Red API: `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test -- recovery.test.ts'` -> FAIL, `../src/recovery.js` missing, no tests ran.
  - Green API: same command -> 1 file, 26/26 passed.
  - Red web: `npm --workspace apps/web run test -- RecoveryScreen.test.tsx` -> FAIL, `./RecoveryScreen` import unresolved.
  - Green web: first run 13/14 (my own "not your fault" copy tripped the blame-free assertion; reworded), then full `npm --workspace apps/web run test` -> 8 files, 94/94 passed.
  - Full API regression (emulators) -> 13 files, 313/313 passed.
  - `npm run typecheck` -> clean (contracts, api, web). `git diff --check` -> clean. Hygiene grep over the branch diff (sfdc/salesforce/chander//Users//secret/password/apikey) -> no hits.
- **Post-integration verification:** Not run
- **Changed paths:** `packages/contracts/src/recovery.ts`, `apps/api/src/recovery.ts`, `apps/api/src/recovery-routes.ts`, `apps/api/test/recovery.test.ts`, `apps/web/src/RecoveryScreen.tsx`, `apps/web/src/RecoveryScreen.test.tsx`.
- **Limitations or skipped checks:**
  - Transitions: the shared table has a legal edge to Recover from every origin (Observe, Check, Pause, Verify, Resolve); all use `transition()`. Recover->Recover is not in the table, so a repeat entry with a new key records an event but writes no phase edge. No illegal edge is written.
  - `confirmed.paidPayment` is stored in retention's `RetainedPaidPayment` shape (`payeeId`, `amountMinor`, ...). `buildRetainedConfirmed` (serialized `retention.ts`) copies only payee/amount, so transaction time, payment method and reference ID are dropped on facts-24h close and are prompted again afterwards. Carry-forward if they should survive.
  - The plan snippet reads `confirmed.payee`/`confirmed.amountMinor`; the integrated facts use `payee` and `amount` (string). Caller-request prefill accepts `amount` only as a plain digit string of minor units; anything else is treated as incomplete (no one-tap match).
  - A cancelled simulated draft still yields a labeled prefill (never proof); a change to the draft invalidates its fingerprint (`STALE_PREFILL`).
  - Added beyond the plan's named exports: `recordAcknowledgement` + `/recovery/acknowledgement` (local simulated note only, `recoveryAcknowledgement` on the projection), `readRecoveryState`/GET route. Routes are not mounted in `app.ts`; tested via `buildApi([createRecoveryRoutes()], deps)`.
  - Not done: no browser/e2e run (no `App.tsx` wiring in scope).

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Review, then integrate. Route mounting (`createRecoveryRoutes()` into `app.ts`) and `App.tsx` wiring belong to DSN-014.
- **Unresolved issues:** Retention drops optional paid fields on close (see Limitations); serialized `retention.ts` carry-forward.
