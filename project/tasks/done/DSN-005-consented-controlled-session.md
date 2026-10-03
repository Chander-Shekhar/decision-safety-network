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

- **Commits (on `task/DSN-005-consented-controlled-session`):**
  - `a5660ad` — `DSN-005: add consented controlled session contract and API`
  - `9d85c12` — `DSN-005: add live session screen UI`
  - `0af3e6c` — `DSN-005: record verification evidence for consented controlled session`
  - `a94a914` — `DSN-005: pin event documents never contain raw transcript text` (post-review test-only addition for reviewer finding L3; appends sentinel-bearing segments and asserts the committed event docs carry no `text` field and no serialized field containing the sentinel).
- **Integration commit:** `5a88b56` — `DSN-005: integrate consented controlled session` (`--no-ff` merge into local `main` after independent read-only review returned APPROVE with no blocking findings; branch history was already hygiene-clean, no rewrite needed).
- **Commands and results:**
  - `firebase emulators:exec --project demo-dsn --only auth,firestore 'npm run test:api -- session.test.ts'` → Test Files 1 passed (1), Tests 21 passed (21).
  - `npm run test:web -- SessionScreen.test.tsx` → Test Files 1 passed (1), Tests 6 passed (6).
  - `npm run typecheck` → clean across `@dsn/contracts`, `@dsn/api`, `@dsn/web`.
  - `git diff --check` → clean (no whitespace errors).
  - After the L3 test (`a94a914`): `firebase emulators:exec --project demo-dsn --only auth,firestore 'npm run test:api -- session.test.ts'` → Tests 22 passed (22); typecheck clean; `git diff --check` clean.
  - Full-suite regression: `firebase emulators:exec --project demo-dsn --only auth,firestore 'npm run test:api'` → Test Files 4 passed (4), Tests 59 passed (59) at the time of the pre-L3 run (38 pre-existing + 21 new; no regression).
  - Emulators required `JAVA_HOME` pointed at a locally cached JDK 21 (firebase-tools needs ≥21; the default JDK on this machine is 17); that absolute path is not recorded here or anywhere else in the repo.
- **Post-integration verification:** On integrated `main` @ `5a88b56` (JAVA_HOME → local JDK 21, path not committed; `--project demo-dsn`): `npm run typecheck` → exit 0 across `@dsn/contracts`, `@dsn/api`, `@dsn/web`; `npx firebase emulators:exec --only auth,firestore 'npm run test:api'` → **Test Files 4 passed (4), Tests 60 passed (60)** (38 foundation/plan + 22 session incl. L3), script exited 0; `npm run test:web` → **Test Files 2 passed (2), Tests 16 passed (16)** (10 plan + 6 session); `git diff --check` → clean; working tree clean. (No lockfile/dependency change in this task, so `npm ci` was not re-run; benign offline GCP `MetadataLookupWarning` during the emulator run.)
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
  - **Cross-task follow-ups raised by review (non-blocking, tracked here so they are not lost):**
    - **L1 → DSN-013.** `endSession` purges every segment doc in a SINGLE Firestore transaction (≤500 writes). A session exceeding ~500 segments would fail to close/purge, and since DSN-013's public close relies on this purge, a failed close would leave raw transcript unpurged. Fine at Cup demo scale; DSN-013 must use a bounded bulk-delete path (its deletion paths already do) rather than this single-transaction purge for the real close, or chunk the delete. The integrator will carry this into the DSN-013 dispatch.
    - **L2 → deploy task (DSN-014 / root `firebase.json`).** The per-segment `expiresAt` ("backstop TTL", `SEGMENT_BACKSTOP_TTL_MS`) is written but NOT enforced: there is no native Firestore TTL policy in the repo. An abandoned session (never revoked, never closed) retains raw transcript until such a policy is deployed. The TTL policy is serialized root/deployment config, out of DSN-005 scope; the integrator will carry it into the deploy task. The same latent gap already applies to `case-store`/`ally-pairing` `expiresAt`.
    - **L4 (accepted, no action).** `session.ts` uses `new Date()` directly rather than the injected `deps.now()`; consistent with `case-store.ts`. The injectable-clock convention is simply not threaded into these store modules; harmless.

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Done — integrated into local `main` @ `5a88b56` and verified. Unblocks DSN-006 (live Gemini facts/provenance adapter, which calls `appendSegment` with its own callback). L1/L2 carried forward to DSN-013 and the deploy task respectively.
- **Unresolved issues:** None blocking; L1/L2 are tracked cross-task follow-ups above.
