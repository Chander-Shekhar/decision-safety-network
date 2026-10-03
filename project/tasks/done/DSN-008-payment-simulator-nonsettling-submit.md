# DSN-008: Payment simulator, cross-context bind, non-settling submit

- **Scope:** core
- **Priority:** P0
- **Owner:** DSN-008 implementer subagent (serialized under integrator)
- **Branch/worktree:** `task/DSN-008-payment-simulator-nonsettling-submit` @ `.worktrees/dsn-008-payment-simulator-nonsettling-submit`
- **Owned paths:** `packages/contracts/src/payment.ts`, `apps/api/src/{payment,payment-routes}.ts`, `apps/api/test/payment.test.ts`, `apps/web/src/{PaymentPanel,PaymentPanel.test}.tsx`
- **Dependencies:** DSN-003 (done @ e560d2d), DSN-006 (done @ 057626d), DSN-007 (done @ e9f9aea)
- **PRD references:** C4 conversation/payment bind; C5
- **Decision references:** 0001; consumes 0004 (fact-extraction events) context via `GeminiPort.relate`
- **Started:** 2026-10-03

## Outcome

Server-owned new-payee simulator; validated-relation join; submit stays pending until explicit human action; races never auto-settle or fabricate Pause. See plan Task 6 (DSN-008). UI frames 02, 03.

## Boundaries

- Included: `PaymentDraft`/`PaymentState`/`PaymentProjection`, `saveDraft`, `submitIntent`, `recheckRelation`, `applyValidatedRelation`, PaymentPanel, recheck route.
- Excluded: human action commands (DSN-009). Browser never sends `newPayee` or policy result. Payment persistently **Simulated**; intervention before OTP, never a real held/reversed transfer.

## Acceptance checks

- [x] Server validates amount/beneficiary, derives new-payee; joined intervention needs valid cited conversation + unchanged current draft; payment-only/conversation-only stay proportionate.
- [x] Every submit pending until explicit human action; changed-draft/late-segment/stale-result/timeout/outage races never auto-complete or fabricate Pause; current valid result can advance pending case through legal states.
- [x] Red→green per plan Task 6; `test:api -- payment.test.ts` + `test:web -- PaymentPanel.test.tsx` + `typecheck` pass; `git diff --check` clean.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits:** `d9940d2` DSN-008: add payment simulator, cross-context bind, and non-settling submit; `54b74aa` record evidence; `753c486` DSN-008: persist reasons in applyValidatedRelation's tx.update calls (B1 fix) — all on `task/DSN-008-payment-simulator-nonsettling-submit`.
- **Integration commit:** `611f85b` DSN-008: integrate payment simulator, cross-context bind, and non-settling submit (`--no-ff` merge into local `main`).
- **Independent review:** read-only reviewer (`dsn008-review`) verdict CHANGES-REQUIRED → one blocking defect **B1 (MEDIUM)**: `applyValidatedRelation`'s `tx.update` field lists omitted `reasons`, so a Check→Pause recheck persisted the new `phase` but left `reasons` stale (lost `large-new-payee` grounding — the WHY of the Pause). Non-blocking: N1 hardcoded `unverified:true` (defensible for this build; **tracked forward to DSN-010** — makes DSN-007's legitimate-pressure acceptance row unreachable until a verification mechanism exists), N2 exported no-uid `applyValidatedRelation` (not route-exposed, no live hole), N3 stale `segmentIds` snapshot on discard path (self-healing), N4 `segmentIds.length` recheck-trigger proxy (append-only segments). Checklist items 1–10 verified clean.
- **Fix (`753c486`):** persist the single `toPaymentReasons(decision.reasons)` value in both `tx.update` branches so persisted `reasons` always match the returned projection and the persisted `phase`; also carry reason codes on the `payment.relation-applied` event's `refs` (`[...reason codes, ...cited segment ids]`, mirroring `fact-validator.ts`, within the existing `CaseEvent.refs: string[]` — no shared type touched). Added a regression test that reads a FRESH projection after a joined Pause and asserts persisted `large-new-payee` grounding + persisted reasons deep-equal returned. Fix diff + test independently re-reviewed by integrator; proven to fail pre-fix. No serialized file touched.
- **Commands and results (pre-integration, on branch):**
  - API suite under emulator → `Test Files 8 passed (8)`, `Tests 188 passed (188)` (24 payment cases + the new B1 regression; 163 pre-existing unchanged).
  - `npm run test:web` → `Test Files 4 passed (4)`, `Tests 41 passed (41)`.
  - `npm run typecheck` → clean across all three workspaces.
  - `git diff --check` → clean.
- **Post-integration verification (on `main` @ `611f85b`):**
  - `npm run typecheck` → clean across `@dsn/contracts`, `@dsn/api`, `@dsn/web`.
  - `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test'` → `Test Files 8 passed (8)`, `Tests 188 passed (188)`.
  - `npm --workspace apps/web run test` → `Test Files 4 passed (4)`, `Tests 41 passed (41)`.
  - `git diff --check` → clean. Hygiene scan of the six committed files → no absolute path, workplace URL/email, or secret.
- **Changed paths:** `packages/contracts/src/payment.ts`, `apps/api/src/payment.ts`, `apps/api/src/payment-routes.ts`, `apps/api/test/payment.test.ts`, `apps/web/src/PaymentPanel.tsx`, `apps/web/src/PaymentPanel.test.tsx` — exactly the six declared owned paths; confirmed via `git status --porcelain` that no other file was touched and no serialized file (`app.ts`, `policy.ts`, `transitions.ts`, `case-store.ts`, `fact-validator.ts`, `package.json`, `firestore.rules`, etc.) was modified.
- **Limitations or skipped checks:**
  - `PaymentReason { code, text, sourceSegmentIds, paymentEventId?, correctionEventId? }` was added to `packages/contracts/src/payment.ts` beyond the brief's literal 3-field `PaymentProjection` (`paymentDraft`/`paymentState`/`segmentIds`); a `reasons: PaymentReason[]` field was added to `PaymentProjection` so a reason/outcome trail is readable by DSN-009's future ActionConsole, since `commitCaseCommand`'s event shape (in the serialized `case-store.ts`) hardcodes `policyVersion`/`refs: []` with no reducer-exposed hook to carry policy reasons on the event itself. `paymentDraft` is optional (no draft exists before the first `saveDraft`).
  - `applyValidatedRelation(db, caseId, relation, options)` deliberately has no `uid` parameter (matches the plan's test-sketch call shape) and is treated as internal/trusted — it is never exposed directly via an HTTP route; only `recheckRelation` (which does check ownership + consent first) calls it.
  - The real `CandidateRelation` shape (from `GeminiPort.relate`) uses `matches: RelationFieldMatch[]` plus `directedAction: boolean`, not the plan's illustrative plain boolean/string stand-ins; `payment.ts`'s `relationConfirms`/`isCurrentRelation` were written against the real shape, re-verifying staleness independently rather than only trusting `gemini.ts`'s own `STALE_RELATION` check.
  - Recheck dedup key: `recheck-{inputCaseVersion}-{draft.id}-{draft.version}`, computed fresh from current case state before each `relateWithRetry` call and checked against existing event ids before calling the model — mirrors `fact-validator.ts`'s `extract-${expectedVersion}` idempotency pattern. Consent (`sessionClosed`/processing-consent) and case ownership are checked before any segment read or model call, ahead of the dedup check.
  - Conversation signal derivation (`deriveConversationSignals`) reads only `FactsProjection.confirmed.observedTactics`/`confirmed.centralClaim` (never raw `facts`), and hardcodes `unverified: true` — there is no independent verification mechanism yet (e.g. a real bank/registry lookup for the beneficiary); this is consistent with the Core MVP's simulated-trust-only scope but is a real limitation if a later task assumes verification exists.
  - Correction-rollback orchestration (undoing a previously-applied relation when a correction event invalidates its source segment) is not implemented in this task — out of scope per the plan's Task 6 boundary; every edit still invalidates the prior relation going forward (new `saveDraft` bumps draft `version`, which fails `isCurrentRelation` on the next check), but no automatic retroactive rollback of an already-applied phase change is performed.
  - DSN-008's `applyValidatedRelation` is the sole call site of `assessCase`/`transition` wired to the payment surface; confirmed DSN-009's `act()` does not call `assessCase` itself.
  - No check was skipped; all three acceptance checks above were verified against the commands listed, not inferred.

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Done — integrated at `611f85b`, post-integration gate green. No follow-up for this task.
- **Carry-forwards:**
  - **DSN-009:** reads persisted `PaymentProjection.reasons` (now durable on every phase change) for the ActionConsole / frame-03 decision states; `applyValidatedRelation` is the sole payment-side `assessCase`/`transition` call site — DSN-009's `act()` must not call `assessCase` itself.
  - **DSN-010:** N1 — `deriveConversationSignals` hardcodes `unverified:true`; revisit when a verification mechanism lands, else DSN-007's legitimate-pressure (`unverified:false`) acceptance row stays unreachable.
  - **Residuals (non-blocking):** N2 keep `applyValidatedRelation` internal-only (never route-expose without an ownership check); N3/N4 noted, self-healing.
