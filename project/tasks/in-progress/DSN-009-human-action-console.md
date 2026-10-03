# DSN-009: Human action console and resolved prevention

- **Scope:** core
- **Priority:** P0
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** `apps/api/src/decision-routes.ts`, `apps/api/test/decision.test.ts`, `apps/web/src/{ActionConsole,ActionConsole.test}.tsx`
- **Dependencies:** DSN-003, DSN-007, DSN-008
- **PRD references:** C6 action console; C9 prevention resolution
- **Decision references:** 0001
- **Started:** Not started
- **Last updated:** 2026-10-03

## Outcome

Explicit idempotent human actions (pause/cancel/verify/acknowledged-continue); ≤3 grounded reasons; pre-OTP copy; manual controls survive Gemini failure. See plan Task 7 (DSN-009). UI frames 03, 03b, 05.

## Boundaries

- Included: `act`, action routes, ActionConsole. `ask-ally` only opens DSN-011 preview (no grant side effect; not shown completed/dropped until DSN-011 exists).
- Excluded: Verify completion (DSN-010), ally grant (DSN-011). Model response cannot issue a command.

## Acceptance checks

- [ ] Pause/Cancel/Verify/acknowledged-Continue create inspectable idempotent simulated state changes; ack starts unchecked with Confirm Continue disabled; Continue w/o ack denied (`ACK_REQUIRED`); non-joined Check uses ordinary confirmation; manual actions available during Gemini failure.
- [ ] Console shows ≤3 source-grounded reasons, large keyboard-operable actions, persistent **Simulated**, pre-OTP copy, no "held your real transfer" claim.
- [ ] Red→green per plan Task 7; `test:api -- decision.test.ts` + `test:web -- ActionConsole.test.tsx` + `typecheck` pass; `git diff --check` clean.

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

- **Next action:** Blocked on DSN-008 integration.
- **Unresolved issues:** None recorded.
