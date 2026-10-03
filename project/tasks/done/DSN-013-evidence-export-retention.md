# DSN-013: Evidence, export, retention, and deletion

- **Scope:** core
- **Priority:** P0
- **Owner:** DSN-013 implementer subagent (serialized under integrator)
- **Branch/worktree:** `task/DSN-013-evidence-export-retention` @ `.worktrees/dsn-013-evidence-export-retention`
- **Owned paths:** `packages/contracts/src/evidence.ts`, `apps/api/src/{retention,retention-routes,export,evidence-routes}.ts`, `apps/api/test/{evidence,retention}.test.ts`, `apps/web/src/{EvidenceScreen,EvidenceScreen.test}.tsx`
- **Dependencies:** DSN-009 (done @ fe7b8bb); also DSN-003 endSession @ e560d2d, DSN-007 facts @ e9f9aea, DSN-008 payment @ 611f85b. Provides selected-evidence/retention API to DSN-011, DSN-012.
- **PRD references:** C11 evidence/handoff; C12 retention/deletion
- **Decision references:** 0001, 0005 (Proposed), 0006 (Proposed)
- **Started:** 2026-10-03
- **Last updated:** 2026-10-04

## Outcome

Evidence promotion + origin-separated timeline; three retention modes via sole close route; recursive deletion w/ unlinkable tombstone; consent-gated ZIP (brief.html/provenance.json/ncrp-preview.html) reviewable preview; expiry + authenticated sweep. See plan Task 11 (DSN-013). UI frame 06.

## Boundaries

- Included: `promoteEvidence`, `readSelectedEvidence`, `closeSessionWithRetention`, `deleteCaseContent`, `sweepExpiredCases`, `buildExportZip`, EvidenceScreen; sole `POST /api/v1/cases/:id/session/close`; `POST /internal/retention/sweep` (scheduler OIDC only).
- Excluded: Cloud Scheduler wiring (DSN-014). Export never a submitted report; caller claim never shown as verified bank fact; proposed never fills actual-paid.

## Acceptance checks

- [x] All three retention modes pass through sole close route; confirmed-only default removes raw/unselected/grants/identifying events; selected-7d retains only chosen excerpts; interrupted close retry converges.
- [x] Export requires active consent; HTML brief + provenance JSON + source-dated NCRP preview, unknown fields blank, "not submitted or accepted" copy; immediate deletion removes all descendants + unlinkable tombstone; expiry blocks reads; authenticated sweep removes data; Firebase token cannot invoke sweep.
- [x] Red→green per plan Task 11; `test:api -- evidence.test.ts retention.test.ts` + `test:web -- EvidenceScreen.test.tsx` + `typecheck` pass; `git diff --check` clean.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits (this branch, in order):**
  - `5304f4d` DSN-013: stub untrusted draft files for genuine red (pre-session: overwrote an earlier timed-out, unrun, untrusted draft with `export {};` stubs so red would be genuine).
  - `2888dd4` DSN-013: add evidence contract types and red retention/export/screen tests.
  - `36bcede` DSN-013: implement retention, close, delete, sweep, and export to green.
  - `74a6d51` DSN-013: implement EvidenceScreen to green.
  - `462c951` DSN-013: record ZIP-writer and scheduler-OIDC decisions (0005, 0006).
  - Review-fix round: `7238c98` (B1 open-case export normalization), `c370ddc` (B2 partial / B3 / N2 / N3 / N4).
- **Integration commit:** `f9e3e90` DSN-013: integrate evidence, export, retention, and deletion (integrator `--no-ff` merge of `task/DSN-013-evidence-export-retention` into local `main`, on top of claim `e6b71b1`).
- **Post-integration verification (on local `main` at `f9e3e90`):** `npm run typecheck` (contracts+api+web) clean; `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test'` → **287/287** (12 files); `npm --workspace apps/web run test` → **80/80** (7 files); `git diff --check` clean; integrator hygiene scan across all six owned source files → no hits. Integrator independently audited the review-fix surface (`pruneToRetained` transactional re-check, `deleteCaseContent` owner-check + absent-case convergence, `sweepExpiredCases` per-case try/catch + no-progress guard, `promoteEvidence` expiry assert, `evidence-routes` 410/409 maps, and the hand-rolled OIDC verifier: RS256-only, exact aud/email+email_verified, exp enforced, signature actually verified against a kid-resolved PEM — a Firebase user token is rejected by construction).
- **Commands and results:**
  - Red proof: `npm run typecheck --workspace apps/api` (before any of the 4 stub implementation files were touched) failed with exactly 15 `TS2305 "has no exported member"` errors against the still-stubbed `retention.ts`/`retention-routes.ts`/`export.ts`/`evidence-routes.ts`. `npm run test:web -- EvidenceScreen.test.tsx` failed with "Failed to resolve import './EvidenceScreen'" (0 tests ran). Both captured before any implementation was written.
  - Green, API-only new suites: `JAVA_HOME=<cached JDK 21> npx firebase emulators:exec --project demo-dsn --only auth,firestore "npm run test:api -- evidence.test.ts retention.test.ts"` → **53/53 passed** (2 files).
  - Green, full API regression: same emulator command with `npm run test:api` (no filter) → **278/278 passed** (12 files) - confirms no existing route/module regressed.
  - Green, web: `npm run test:web -- EvidenceScreen.test.tsx` → **9/9 passed**; `npm run test:web` (full regression) → **80/80 passed** (7 files).
  - `npm run typecheck` (all three workspaces: `@dsn/contracts`, `@dsn/api`, `@dsn/web`) → clean.
  - `git diff --check` and `git diff --cached --check` → clean (no whitespace errors).
  - Hygiene scan: `git diff HEAD -- apps/web/src/EvidenceScreen.tsx | grep -niE "sfdc|salesforce|chander|/Users/|secret|password|apikey"` → no matches. The same forbidden strings were kept out of every other new/changed file by construction (no absolute local paths, workplace identifiers, or secrets appear in any committed source).
- **Review-fix round (red -> green):** each regression test was written first and failed for the stated reason before its fix.
  - B1: open-case export threw `TypeError ... reading 'replace'` (2 tests red) -> fixed by `normalizeConfirmed` in `export.ts`, reusing the exported `buildRetainedConfirmed` so pre- and post-close provenance labels agree (`selected evidence` only if every citing segment is promoted). evidence.test.ts 19/19.
  - B3: lengthened-expiry and expired-mutator tests red -> `revokeRetentionConsent` now uses `min(existing expiresAt, now+24h)`; `revokeRetentionConsent` (downgrade path), `revokeExportConsent`, `promoteEvidence` reject `EXPIRED` (410 in `evidence-routes.ts` LOCAL_ERROR_STATUS). The downgrade's final write is also now a version-checked transaction (`CONCURRENT_MODIFICATION`, 409) so it cannot overwrite a concurrent export-consent revocation.
  - B2 (partial): test red (prune resolved and clobbered) -> the final `pruneToRetained` write is now a transaction that re-reads, requires `closing === true` and an unchanged `version`, else throws `CONCURRENT_MODIFICATION` (409); retry converges. The race is simulated through a `beforeFinalWrite` hook on `closeSessionWithRetention` (test seam), not a true concurrent writer, so it proves the re-check rejects a stale write but not real interleaving. Full fix is a carry-forward (see Handoff).
  - N2: retry-after-delete now resolves (`markClosing` treats an absent case as converged only for `delete-on-close`; `deleteCaseContent` is a no-op on an absent case); wrong owner on an existing case is still `FORBIDDEN` (tested).
  - N3: `deleteCaseContent` and `pruneToRetained` discover children with `listCollections()` (paged deletes kept; prune keeps only `evidence` under `selected-7d`); extra-subcollection test covers all modes.
  - N4: `sweepExpiredCases(db, now, deleteCase = deleteCaseContent)` catches per case, logs, and returns `{ swept, failed }` (route now returns that object); a no-progress page stops the loop so a poison page cannot spin. Tested with an injected failing deleter.
  - Final: API **287/287** (12 files), web **80/80**, `npm run typecheck` clean, `git diff --check` clean.
- **Changed paths:**
  - `packages/contracts/src/evidence.ts` (new: `EvidenceExcerpt`, `RetainedFact`, `RetainedPaidPayment`, `RetainedConfirmed`, `RetainedCaseProjection`, `DeletionTombstone`, `ManifestFact`).
  - `apps/api/src/retention.ts` (new: `closeSessionWithRetention`, `deleteCaseContent`, `sweepExpiredCases`, `promoteEvidence`, `readSelectedEvidence`, `revokeExportConsent`, `revokeRetentionConsent`, plus private `markClosing`/`pruneToRetained`/`buildRetainedConfirmed`/`deleteCollection` helpers).
  - `apps/api/src/evidence-routes.ts` (new: `createEvidenceRoutes` - the sole close route plus promote/read-selected-evidence/export/export-consent-revoke/retention-consent-revoke).
  - `apps/api/src/retention-routes.ts` (new: `createRetentionRoutes`, `SchedulerIdentityConfig`, `OidcKeySource` - scheduler-only sweep route).
  - `apps/api/src/export.ts` (new: `buildExportZip`, `buildZip`, `escapeHtml`, `NCRP_FIELD_MAP`).
  - `apps/api/test/retention.test.ts`, `apps/api/test/evidence.test.ts` (new, 53 tests total).
  - `apps/web/src/EvidenceScreen.tsx`, `apps/web/src/EvidenceScreen.test.tsx` (new, 9 tests).
  - `project/decisions/0005-dsn013-minimal-zip-writer.md`, `project/decisions/0006-dsn013-scheduler-oidc-gating.md` (new, both Status: Proposed).
- **Limitations or skipped checks:**
  - **OIDC/JWKS is partial by design.** `retention-routes.ts` verifies audience, service-account email, expiry, and RS256 signature against an *injectable* `OidcKeySource`; it does not fetch or cache Google's live, rotating JWKS. Production wiring of a real key source, plus the actual Cloud Scheduler job's `audience`/`serviceAccountEmail`, is deferred to DSN-014 (recorded in decision 0006). Until that lands, `createRetentionRoutes` is not mounted into `app.ts` and the route is unreachable in the deployed app.
  - **No real ally-read route exists yet.** `ally.ts`/`ally-routes.ts` are not implemented (DSN-011 is still backlog), confirmed by directory listing. "Revoked ally blocked after close/deletion" is tested only at the data layer (seeding a synthetic `allyGrants` doc directly and asserting the collection empties on close/delete) - there is no real HTTP ally-read path to exercise end-to-end yet. DSN-011 should add that end-to-end test once its route exists.
  - **Routes are not mounted into the public app.** Neither `createEvidenceRoutes()` nor `createRetentionRoutes(config)` is wired into `apps/api/src/app.ts`'s real `buildApi` call (that file is off-limits/serialized to this task) - all route-level tests build their own isolated `buildApi([...], deps)` instance, matching every other feature module's own test convention in this codebase. Mounting both into the real app, plus the Cloud Scheduler wiring, is DSN-014's job.
  - **Closing-flag enforcement is scoped to this task's own functions.** The transient `closing`/`closingMode` case-doc fields are read/written only by `retention.ts` itself; no change was made to `case-store.ts`/`app.ts` (both off-limits) to make other routes respect `closing` the way `promoteEvidence` does. In the current codebase the only other writers of a case document mid-session (`appendSegment`, `revokeProcessing`) already stop on `sessionClosed`, which `markClosing` leaves untouched until the mode-specific step completes - so no live route can race a close in a way visible to a test - but this was not independently re-verified against every other feature module's write path beyond that.
  - **N1 (deliberate deviation):** the close path does not use `commitCaseCommand` or an idempotency key. `markClosing`, `endSession`, and the prune each bump `version` without a backing event, so the one-event-per-version-bump invariant is relaxed for the close/retention lifecycle; convergence is mode-based instead. DSN-014 should decide whether to reconcile this.
  - **N5 (by design):** a closed case's `exportConsent` is a point-in-time snapshot of the plan's live value; later plan changes do not propagate, only `revokeExportConsent` mutates it.
  - **Lost review items:** the reviewer's N6-N8 and nits were lost to a message-truncation classifier and were not available this round; they are unaddressed.
  - **B2 is only partially closed:** ordinary reads/commands are not blocked while `closing`, so a concurrent fact/payment/correction command can still interleave before the final transactional write (which will then abort with `CONCURRENT_MODIFICATION`, leaving the case `closing` for a retry). Collection deletes before that write are not transactional, so a doc re-created in that window can survive until the next sweep/retry.
  - **ZIP writer is store-only (no compression)** - decision 0005. Fine for three small text artifacts; would need revisiting if export ever carries larger/binary content.
  - **Dependencies this task relied on were all genuinely satisfied**, not merely assumed: `createCase`/`readCase` (case-store.ts), `endSession`/`revokeProcessing` (session.ts), `savePlan` (plan.ts), and the `Fact`/`CaseEnvelope`/`RetentionMode` contract shapes were all read in full this session before being relied upon; none were modified.

## Blocker or deferral

Not applicable - task is complete within its owned paths and ready for integrator review.

## Handoff

- **Next action (integrator / DSN-014):**
  1. Mount `createEvidenceRoutes()` and `createRetentionRoutes(config)` into `apps/api/src/app.ts`'s real `buildApi` composition.
  2. Wire a production `OidcKeySource` (fetch + cache Google's live JWKS by `kid`) and configure the real Cloud Scheduler job's `audience`/`serviceAccountEmail` (decision 0006's explicit carry-forward).
  3. Add the actual Cloud Scheduler job/schedule hitting `POST /internal/retention/sweep`.
  4. Review decisions 0005 and 0006 (currently Status: Proposed) and move to Accepted/Superseded as appropriate.
  5. ~~Integrate this branch into `main` after review~~ — DONE by integrator (`f9e3e90`); post-integration gate green (see Verification evidence).
  6. **B2 carry-forward (DSN-014, serialized files):** `readCase` and `commitCaseCommand` must reject a case whose `closing === true` so that fact-confirm/payment/correction commands cannot interleave with a close; `promoteEvidence` already guards this locally. Also decide whether to reconcile the close lifecycle's relaxed version/event invariant (N1).
- **Unblocks:** DSN-011 (ally sharing) and DSN-012 (payment/correction flows) can now build against the selected-evidence/retention API (`promoteEvidence`, `readSelectedEvidence`, `closeSessionWithRetention`, the retained-confirmed-facts shape in `packages/contracts/src/evidence.ts`). DSN-011 should also add a real end-to-end "revoked ally blocked" test once its own route exists, superseding this task's data-layer-only proxy test.
- **Unresolved issues:** The stale "Blocked on DSN-009 integration" note has been removed - DSN-009 was already integrated (@ `fe7b8bb`, per the Dependencies line) before this session began; this task was never actually blocked on it.
