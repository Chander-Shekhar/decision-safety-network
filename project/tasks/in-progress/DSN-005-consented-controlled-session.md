# DSN-005: Consented incremental controlled session

- **Scope:** core
- **Priority:** P0
- **Owner:** DSN-005 implementer subagent (serialized under integrator)
- **Branch/worktree:** `task/DSN-005-consented-controlled-session` @ `.worktrees/dsn-005-consented-controlled-session`
- **Owned paths:** `packages/contracts/src/session.ts`, `apps/api/src/{session,session-routes}.ts`, `apps/api/test/session.test.ts`, `apps/web/src/{SessionScreen,SessionScreen.test}.tsx`
- **Dependencies:** DSN-003 (done @ e560d2d), DSN-004 (done @ 0564d69)
- **PRD references:** C2 controlled live session; C12 consent revocation
- **Decision references:** 0001
- **Started:** 2026-10-03

## Outcome

Ordered, consented, incremental transcript intake with per-segment versioned events; close purges raw segments; no public close route. See plan Task 3 (DSN-005). UI frame 02.

## Boundaries

- Included: `TranscriptSegment`, `appendSegment`, `revokeProcessing`, internal `endSession` (no public route), SessionScreen controlled/processing/degraded status.
- Excluded: Gemini adapter (DSN-006); public close command (DSN-013 owns it). Never imply microphone capture.

## Acceptance checks

- [x] Ordered segments accepted incrementally, one metadata event/version each; duplicates idempotent; gaps/conflicts rejected (`ORDER_CONFLICT`).
- [x] Processing revocation / internal close stops intake + callbacks; close purges raw segments; no public close route bypasses DSN-013; UI shows controlled/processing/degraded accurately.
- [x] Red→green per plan Task 3; `test:api -- session.test.ts` + `test:web -- SessionScreen.test.tsx` + `typecheck` pass; `git diff --check` clean.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits:** (this branch, awaiting integrator merge)
  - `DSN-005: add consented controlled session contract and API`
  - `DSN-005: add live session screen UI`
  - `DSN-005: record verification evidence for consented controlled session`
- **Integration commit:** awaiting integrator
- **Commands and results:**
  - `firebase emulators:exec --project demo-dsn --only auth,firestore 'npm run test:api -- session.test.ts'` → Test Files 1 passed (1), Tests 21 passed (21).
  - `npm run test:web -- SessionScreen.test.tsx` → Test Files 1 passed (1), Tests 6 passed (6).
  - `npm run typecheck` → clean across `@dsn/contracts`, `@dsn/api`, `@dsn/web`.
  - `git diff --check` → clean (no whitespace errors).
  - Full-suite regression: `firebase emulators:exec --project demo-dsn --only auth,firestore 'npm run test:api'` → Test Files 4 passed (4), Tests 59 passed (59) (38 pre-existing + 21 new; no regression).
  - Emulators required `JAVA_HOME` pointed at a locally cached JDK 21 (firebase-tools needs ≥21; the default JDK on this machine is 17); that absolute path is not recorded here or anywhere else in the repo.
- **Post-integration verification:** awaiting integrator
- **Changed paths:**
  - `packages/contracts/src/session.ts` (new)
  - `apps/api/src/session.ts` (new)
  - `apps/api/src/session-routes.ts` (new)
  - `apps/api/test/session.test.ts` (new)
  - `apps/web/src/SessionScreen.tsx` (new)
  - `apps/web/src/SessionScreen.test.tsx` (new)
  - This task record
- **Limitations or skipped checks:**
  - No public close/end-session HTTP route in this task by design; `endSession` is exported for DSN-013 to call internally.
  - `sessionRoutes`'s own `onSegment` callback is a no-op (no model dependency yet); a future task (DSN-006) is expected to call `appendSegment` directly with its own callback rather than editing this route file.
  - Same-segment-id-with-different-content and genuine order gaps are both surfaced as `ORDER_CONFLICT` (no separate idempotency-conflict code), to keep the error vocabulary minimal per the acceptance wording.
  - HTTP mapping chosen locally in `session-routes.ts` (not in the shared `app.ts` map): `ORDER_CONFLICT` → 409, `CONSENT_REQUIRED` → 403.
  - Event `result` field uses the shared `CaseCommandResult` shape (`{id, version, phase}`), matching the plan's pseudocode and the repo-wide `CaseEvent.result` contract, rather than an ad-hoc shape.

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Awaiting integrator review and merge to `main`.
- **Unresolved issues:** None recorded.
