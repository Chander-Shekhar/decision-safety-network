# DSN-005: Consented incremental controlled session

- **Scope:** core
- **Priority:** P0
- **Owner:** Unassigned
- **Branch/worktree:** Not claimed
- **Owned paths:** `packages/contracts/src/session.ts`, `apps/api/src/{session,session-routes}.ts`, `apps/api/test/session.test.ts`, `apps/web/src/{SessionScreen,SessionScreen.test}.tsx`
- **Dependencies:** DSN-003, DSN-004
- **PRD references:** C2 controlled live session; C12 consent revocation
- **Decision references:** 0001
- **Started:** Not started
- **Last updated:** 2026-10-03

## Outcome

Ordered, consented, incremental transcript intake with per-segment versioned events; close purges raw segments; no public close route. See plan Task 3 (DSN-005). UI frame 02.

## Boundaries

- Included: `TranscriptSegment`, `appendSegment`, `revokeProcessing`, internal `endSession` (no public route), SessionScreen controlled/processing/degraded status.
- Excluded: Gemini adapter (DSN-006); public close command (DSN-013 owns it). Never imply microphone capture.

## Acceptance checks

- [ ] Ordered segments accepted incrementally, one metadata event/version each; duplicates idempotent; gaps/conflicts rejected (`ORDER_CONFLICT`).
- [ ] Processing revocation / internal close stops intake + callbacks; close purges raw segments; no public close route bypasses DSN-013; UI shows controlled/processing/degraded accurately.
- [ ] Red→green per plan Task 3; `test:api -- session.test.ts` + `test:web -- SessionScreen.test.tsx` + `typecheck` pass; `git diff --check` clean.

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

- **Next action:** Blocked on DSN-004 integration.
- **Unresolved issues:** None recorded.
