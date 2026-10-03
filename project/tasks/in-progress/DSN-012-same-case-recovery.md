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

- [ ] `already-paid` enters Recover from Observe/Check/Pause/Verify/Resolve same case ID; reuses confirmed facts as labeled context; prompts only unknown harm-routing fields; works Gemini-unavailable; proposed ≠ paid until explicit match/edit; `STALE_PREFILL` rejected; cancelled proposal not proof.
- [ ] First screen gives Demo Bank + source-dated 1930 equal priority; labels only local acknowledgements **Simulated**; warns recovery scams; default-retention `source not retained` copy.
- [ ] Red→green per plan Task 10; `test:api -- recovery.test.ts` + `test:web -- RecoveryScreen.test.tsx` + `typecheck` pass; `git diff --check` clean.

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

- **Next action:** Blocked on DSN-009 + DSN-013 retention behavior.
- **Unresolved issues:** None recorded.
