# DSN-006: Live Gemini facts, provenance, and correction

- **Scope:** core
- **Priority:** P0
- **Owner:** DSN-006 implementer subagent (serialized under integrator)
- **Branch/worktree:** `task/DSN-006-live-gemini-facts-provenance` @ `.worktrees/dsn-006-live-gemini-facts-provenance`
- **Owned paths:** `packages/contracts/src/facts.ts`, `apps/api/src/{gemini,fact-validator,fact-routes}.ts`, `apps/api/test/facts.test.ts`, `apps/web/src/{DecisionMap,DecisionMap.test}.tsx`
- **Dependencies:** DSN-003 (done @ e560d2d), DSN-005 (done @ 5a88b56); `@google/genai@2.24.0` provisioned @ 5295ef3
- **PRD references:** C3 living source-linked case; C12 prompt-injection resistance
- **Decision references:** 0001; 0003 (genai client provisioning); 0004 (extraction authorization/idempotency/events, scoped fix)
- **Started:** 2026-10-03

## Outcome

Structured source-linked Gemini extraction with validation, correction, confirmation, provenance labels, and bounded timeout/retry/degraded behavior. See plan Task 4 (DSN-006). UI frame 02. Produces `GeminiPort` consumed by DSN-008.

## Boundaries

- Included: `CandidateFact`/`Fact`/`FactsProjection`/`CandidateRelation`, `GeminiPort`, `validateFacts`, `correctFact`, `confirmFact`, DecisionMap.
- Excluded: policy/action selection (DSN-007). Model never selects actions or returns policy. No scam probability/mental-state label.

## Acceptance checks

- [x] Every accepted model fact schema-valid + cites existing segment; required fields present or `unknown`; corrections/confirmations preserve provenance and supersede model facts.
- [x] New segment → fresh Gemini call; fabricated citations, hostile instructions, stale case/draft versions, post-revocation in-flight results cannot alter trusted state; timeout/one-retry/degraded behavior correct.
- [x] Red→green per plan Task 4; `test:api -- facts.test.ts` + `test:web -- DecisionMap.test.tsx` + `typecheck` pass; `git diff --check` clean.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits (on `task/DSN-006-live-gemini-facts-provenance`):**
  - `8767d55` DSN-006: add source-grounded live case facts
  - `02a3eb5` DSN-006: record verification evidence for live gemini facts
  - `6fa7f49` DSN-006: fix extraction authz ordering, idempotency, and event-emitting per decision 0004 (scoped fix after CHANGES-REQUIRED review; see decision 0004)
  - `033a4e4` DSN-006: record verification evidence for the decision-0004 scoped fix
- **Decision commit (integrator, on `main`):** `a9c5ed9` DSN-006: record decision 0004 (fact extraction authz + event).
- **Integration commit:** `057626d` — `DSN-006: integrate live gemini facts and provenance` (merged `task/DSN-006-...` into local `main` with `--no-ff` after two independent read-only reviews; the second returned **APPROVED** on the decision-0004 scoped-fix delta `02a3eb5..033a4e4`, with three explicitly non-blocking residuals: N1 cosmetic event-`kind` dot-vs-hyphen naming, N2 harmless replay-branch projection field inconsistency on the unused `phase`, N3 decision 0004 already present on the merge target — all noted, none held merge).
- **Commands and results (first round, commits `8767d55`/`02a3eb5`):**
  - `JAVA_HOME=<local JDK 21; path not committed>` + `PATH="$JAVA_HOME/bin:$PATH"` for all emulator runs below.
  - `npx firebase emulators:exec --project demo-dsn --only auth,firestore "npm run test:api -- facts.test.ts"` → 30 passed (30), 1 test file. (First RED run surfaced 1 failing assertion in the test itself - a unit-level call to `extractFacts` asserted a `modelVersion` the test never asked the orchestration to stamp; fixed the test, not the implementation, then reran GREEN.)
  - `npm run test:web -- DecisionMap.test.tsx` → 10 passed (10), 1 test file.
  - `npm run typecheck` → exit 0 across `@dsn/contracts`, `@dsn/api`, `@dsn/web`.
  - `git diff --check` → no output (clean).
  - Full-suite regression: `npx firebase emulators:exec --project demo-dsn --only auth,firestore "npm run test:api"` → 90 passed (90), 5 test files (baseline 60 + 30 new; no regression). `npm run test:web` → 26 passed (26), 3 test files (baseline 16 + 10 new; no regression).
- **Commands and results (second round, commit `6fa7f49`, scoped fix per decision 0004):**
  - Independent review returned CHANGES-REQUIRED: (1) `extractFacts` called `gemini.extract` and the route read transcript segments before any ownership check; (2) missing non-owner extract-route test; (3) extraction bumped `version` on every pass without ever writing a `CaseEvent` (decision 0004); (4) `gemini.ts`'s injection-isolation comment overstated the guarantee. Two further LOW items accepted as-is for the MVP with a documenting comment: `correctFact`/`confirmFact` not checking `sessionClosed`, and `withTimeout` not aborting the first call's underlying promise.
  - Read `project/decisions/0004-fact-extraction-event-and-authorization.md` in full before starting; it is the authority for the idempotency/event-emission fix.
  - Fix: added `assertExtractionAuthorized(db, uid, caseId)` (`fact-validator.ts`), called by `fact-routes.ts`'s extract handler before `readOrderedSegments`/`extractFacts` - a non-owner now gets `FORBIDDEN` with zero segment reads and zero model calls. The commit transaction's own owner/`sessionClosed`/`expectedVersion` checks were kept unchanged (defense in depth).
  - Fix: `extractFacts`'s commit transaction now compares the merged `facts` map to the current one field-wise (`sameFact`/`factMapsEqual`); a no-op change commits nothing (no version bump, no event). A state-changing extraction bumps `version` by one and writes exactly one metadata-only `CaseEvent` (`kind: 'facts.extracted'`, `refs` = changed field names + their cited segment ids, `requestHash`, `result` shape mirroring `commitCaseCommand`), keyed by a stable `extract-{expectedVersion}` id; a retry of an already-committed attempt replays the stored receipt (mirrors `commitCaseCommand`'s event-first replay/requestHash-mismatch check) rather than re-running the session/version checks.
  - Fix: corrected `gemini.ts`'s comment - structured prompt content does not itself prove prompt-injection-proofness; the real guarantees are output-schema (Zod) validation and that a `CandidateFact` never becomes trusted/consequential state without the owner's explicit `correctFact`/`confirmFact`.
  - Added one-line, comment-only notes (no behavior change) on the two accepted LOW items above.
  - New tests in `facts.test.ts`: non-owner POST to the extract route is denied (403) with the fake `GeminiPort.extract` call counter staying at 0; a state-changing extraction bumps `version` by exactly one and writes exactly one new `CaseEvent` (and that event is metadata-only - asserted it never contains the raw transcript text); a second, identical-result extraction bumps neither `version` nor writes a new event.
  - `npx firebase emulators:exec --project demo-dsn --only auth,firestore "npm run test:api -- facts.test.ts"` → 33 passed (33), 1 test file (30 prior + 3 new; all prior assertions - `STALE_EXTRACTION`, post-revocation `CONSENT_REQUIRED`, fabricated-citation drop, prompt-injection inertness, correction-precedence - unaffected by the idempotency/event changes, verified by rerun).
  - `npx firebase emulators:exec --project demo-dsn --only auth,firestore "npm run test:api"` → 93 passed (93), 5 test files (no regression elsewhere).
  - `npm run test:web` → 26 passed (26), 3 test files (untouched this round; no regression).
  - `npm run typecheck` → exit 0 across `@dsn/contracts`, `@dsn/api`, `@dsn/web`.
  - `git diff --cached --check` → no output (clean), scoped to `apps/api/src/fact-routes.ts`, `apps/api/src/fact-validator.ts`, `apps/api/src/gemini.ts`, `apps/api/test/facts.test.ts` only (verified via `git status --short`/`git diff --cached --stat` before committing - no serialized files touched).
- **Post-integration verification:** On integrated `main` @ `057626d` (JDK 21 for the shell only; `JAVA_HOME`/`PATH` never written to any committed file; `--project demo-dsn`): `npm run typecheck` → exit 0 across `@dsn/contracts`, `@dsn/api`, `@dsn/web`; `npm run test:web` → **26 passed (26)**, 3 files; `npx firebase emulators:exec --only auth,firestore 'npm run test:api'` → **93 passed (93)**, 5 files, script exited 0, emulators shut down cleanly; `git diff --check fa34bb7 057626d` → clean; hygiene scan of the integrated tree → only decision 0003's prose documenting the *absence* of workplace URLs matched, no actual leak. (Benign offline `MetadataLookupWarning` from GCP metadata probes; emulator uses local auth. The global-npm `always-auth`/`repo.local.sfdc.net` warning comes from the user's machine-level npm config, not the project `.npmrc`, and is not committed.)
- **Changed paths:** `packages/contracts/src/facts.ts`, `apps/api/src/gemini.ts`, `apps/api/src/fact-validator.ts`, `apps/api/src/fact-routes.ts`, `apps/api/test/facts.test.ts`, `apps/web/src/DecisionMap.tsx`, `apps/web/src/DecisionMap.test.tsx`. (Second round touched only `apps/api/src/{gemini,fact-validator,fact-routes}.ts` and `apps/api/test/facts.test.ts`.)
- **Limitations or skipped checks:**
  - `apps/api/src/gemini.ts` is never exercised against the real Google Cloud endpoint; every test uses an inline fake `GeminiPort`. Live calls remain gated to DSN-014 per decision 0003.
  - Design decision for integrator attention: extraction is triggered via this task's own `POST /api/v1/cases/:id/facts/extract` route (reads currently-persisted segments from Firestore itself) rather than by growing a callback into `session-routes.ts`'s existing segment-append route, per that file's own comment inviting a later task to call `appendSegment` from its own route rather than edit that file. A client flow is therefore: append a segment via the existing session route, then call this task's extract route to trigger a fresh model pass. Whoever wires the frontend session flow (likely a later integration/UI task) needs to call both in sequence.
  - `GeminiPort` is injected into `fact-routes.ts` via a factory (`createFactRoutes(gemini)`) rather than through `ApiDeps`, since `ApiDeps`/`app.ts` are serialized and not owned by this task. Task 12/DSN-014's server assembly should call `createFactRoutes(createGeminiPort())`.
  - `CandidateRelation.matches`'s field-level shape (`RelationFieldMatch { field, matches, sourceSegmentIds }`) was not fully specified by the plan excerpt available to this task; defined a reasonable, documented shape in `packages/contracts/src/facts.ts`. DSN-008 (plan Task 6), which consumes `GeminiPort.relate`/`CandidateRelation` directly, should confirm this shape meets its needs before relying on it.
  - `GeminiPort.relate` has no HTTP route in this task by design - DSN-008 calls it directly as part of its own draft-recheck flow (`gemini.ts` exports `createGeminiPort()`/`RELATE_PROMPT_VERSION` for that purpose).
  - Per decision 0004: the shared case `version` remains the single OCC token for extraction and manual correct/confirm (no parallel facts-revision counter) - a genuine facts change can still invalidate an in-flight manual edit, which is intentional; the idempotent-only-on-change rule ensures only genuine changes do so.
  - Two LOW items accepted as-is for the MVP, now documented with a one-line comment at the point of each: `correctFact`/`confirmFact` do not check `sessionClosed` (manual controls stay available after revocation), and `withTimeout` does not abort the first call's underlying promise on timeout (only races it against a timer).

## Blocker or deferral

Not applicable — integrated and verified on local `main`.

## Handoff

- **Next action:** Done. No further action on this task.
- **Carry-forward for later tasks (not DSN-006 defects):**
  - **Route wiring (DSN-014 / server-assembly task):** the extract/correct/confirm routes are composed only in tests via `buildApi([createFactRoutes(fakeGemini)], deps)`; they are NOT mounted in the serialized `app.ts`. Production assembly must call `createFactRoutes(createGeminiPort())` and mount it, and the client session flow must call the existing session append route then this extract route in sequence (see Limitations). Same route-mounting deferral pattern as prior feature tasks.
  - **Live Gemini (DSN-014):** `gemini.ts` is never exercised against the real endpoint; all tests use a fake `GeminiPort`. Live calls gated to DSN-014 under founder cloud/billing authorization, which must also revisit decision 0003's `@google/genai`/`gaxios`/`uuid` audit before any live call ships.
  - **DSN-008:** consumes `GeminiPort.relate`/`CandidateRelation` directly (no HTTP route here by design); should confirm the `CandidateRelation.matches` shape before relying on it, and read `facts.extracted` events like any other case event.
  - **Non-blocking residuals from re-review (optional cleanup, not required for Cup):** N1 event-`kind` naming convention (`facts.extracted` dot-style vs sibling hyphen-style); N2 replay-branch returns the historical receipt's `version`/`phase` alongside current `facts` (only `.version` is consumed, no correctness impact).
