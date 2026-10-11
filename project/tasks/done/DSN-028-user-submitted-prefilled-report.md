# DSN-028: User-submitted, pre-filled 1930/NCRP report

- **Scope:** core
- **Priority:** P1
- **Owner:** Orchestrator (subagent-driven implementer under integrator)
- **Branch/worktree:** `task/DSN-028-user-submitted-prefilled-report` (isolated worktree)
- **Owned paths:** `apps/api/src/{export,recovery}*` + a new report module + their tests, additive `packages/contracts/src/**` (new report contract), `apps/web/src/EvidenceScreen.tsx` (+ its tests). Serialized/not owned: no state-machine/policy/payment/verification/plan/ally change; the DSN-024 `authority-report` fraud-list basis is wired via the existing `fraud-confirmation` route (do not rewrite `fraud-list.ts`/`screening*`).
- **Dependencies:** DSN-022 (done); DSN-024 (fraud-list `authority-report` basis — done, server-side).
- **PRD references:** Part I — Decision 18; C11; Trust gate (NCRP field-map, label until submitted); non-goal (no unattended submission)
- **Decision references:** 0005, 0010, 0011, 0014
- **Started:** 2026-10-12
- **Last updated:** 2026-10-12

## Outcome

The evidence handoff produces a source-dated, pre-filled official 1930/NCRP form the user reviews and submits themselves through the official channel, replacing the "preview only" framing. Unsupported fields stay blank; the product never submits on the user's behalf and never claims acceptance.

## Boundaries

- Included: pre-filled form generation from confirmed case facts, review UI, one-tap handoff to the official channel for the user to submit, "Draft for your review — not submitted" labeling, recovery-scam warning.
- Excluded: any unattended/background submission; claiming a report was filed or accepted; fabricating unknown fields.

## Acceptance checks

- [x] The export opens a pre-filled, user-reviewable form populated only from confirmed facts; unknowns blank. (`buildReportDraft` fills from `CONFIRMED_ORIGINS` only — user-confirmed/corrected/reported; model-origin and unmapped NCRP fields stay blank. `GET …/report-draft` + `GET …/report-draft/download` attachment HTML; EvidenceScreen renders "(left blank)" for blanks.)
- [x] Nothing is submitted without an explicit user action in the official channel; label reads "not submitted" until the user acts. (`ReportDraft.submitted:false`, `label = REPORT_DRAFT_LABEL`; handoff `requiresUserAction:true` with fictional `…invalid` channel; web opens `window.open(channelUrl)` only after a 200, and only the human submits there. `ReportHandoffResult` states `handedOff:true, filed:false`.)
- [x] No fabricated fields; provenance preserved; recovery-scam warning present. (Each filled field carries provenance; `recoveryScamWarning` rendered `role=alert`; unknowns blank, never guessed.)
- [x] API + web suites green; typecheck clean. (See post-integration verification below.)

## Verification evidence

- **Commits:** `6eed8be` (claim/in-progress), `5503719` (report draft + handoff API), `b92fb5f` (EvidenceScreen review + handoff UI)
- **Integration commit:** `71a0a42` (`git merge --no-ff` of `task/DSN-028-user-submitted-prefilled-report` into local main); `5f2486f` (integrator wiring: mount `createReportRoutes()` in `server.ts`, extend `api-client` `download()` to GET, wire App.tsx Evidence step). Local main only — not pushed.
- **Commands and results:**
  - Implementer/reviewer suites (worktree): web 196/196, API 405/405 (independent reviewer re-ran both; returned READY, no blocking defects).
  - Independent-review invariant checks (direct API tests): outside the Recover phase → `POST …/report-handoff` returns 409 `NOT_IN_RECOVERY` and writes no private list entry; invalid `callerNumber` → 400 `INVALID_BODY`; `authority-report` list entry only lands after the existing `recordAcknowledgement(action:'helpline-1930')` precondition is satisfied (no bypass of `fraud-list.ts`'s `REPORT_NOT_RECORDED`).
- **Post-integration verification (merged main):** `npm run typecheck` clean (contracts + api + web); `npm --workspace apps/web run test` → 21 files, 196/196; API suite under emulators (`firebase emulators:exec --only auth,firestore`, JDK 21) → 21 files, 405/405. (`MetadataLookupWarning` lines are benign GCP metadata probes, unrelated to tests.)
- **Changed paths:** `packages/contracts/src/report.ts` (new, additive); `apps/api/src/{report.ts,report-routes.ts}` (new); `apps/api/src/export.ts` (export keywords only); `apps/api/src/server.ts` (mount route); `apps/web/src/EvidenceScreen.tsx`; `apps/web/src/{App.tsx,api-client.ts}` (integrator wiring); tests for the above; `project/decisions/0014-user-submitted-report-handoff.md` (new).
- **Limitations or skipped checks:** NCRP field-map is a curated, source-dated subset; the official-channel endpoint is a fictional non-resolving `…invalid` placeholder (simulated authority side). No push/deploy performed. See deferred nits below.

## Blocker or deferral

Not applicable.

## Deferred (non-blocking) review nits

Independent reviewer (`dsn028-review`) returned READY against branch `b92fb5f`; integration wiring (`71a0a42`, `5f2486f`) resolved its only pre-integration concern (unmounted `server.ts` routes + unwired `App.tsx`). Remaining non-blocking nits to defer:

1. `report.ts` `recordReportHandoff`: the acknowledgement is written before `addConfirmedFraud`. If the add fails (e.g. a Firestore error) the acknowledgement persists without the list entry; a same-key retry is safe, but this partial-failure path has no test.
2. No test covers a handoff replay — same `idempotencyKey`, or the same key with a different `callerNumber`. The body carries `idempotencyKey` but replay idempotency of the acknowledgement + list entry is unexercised.
3. `report-routes.ts`: 403/401 ownership tests exist only for the draft GET; the download GET and the POST handoff share the same `requireUser`/`readCase` path but have no dedicated ownership test.
4. `EvidenceScreen.tsx`: the caller-number input has no client-side validation, so a bad number only surfaces as a server 400. **Resolved at the wiring layer:** App.tsx `run()` catches `ApiError` and surfaces `Request failed (INVALID_BODY). Nothing was changed.`; because the throw lands on the `await api.command` line, `setReportHandedOff(true)` and `window.open` are both skipped (no handoff recorded, no channel opened on failure).
5. The draft label string is hard-coded in `EvidenceScreen.tsx` and also lives as `REPORT_DRAFT_LABEL` in the contract (the web screen deliberately does not import API types); the two could drift.
6. `normalizeConfirmed` can read the `evidence` subcollection for pre-close cases, so the draft GET does one extra read (no write).
7. NCRP field-map version/source is a curated, source-dated constant; a real deployment needs the authoritative current field set and a resolving official-channel endpoint in place of `SIMULATED_NCRP_CHANNEL_URL`.

## Handoff

- **Next action:** Done. Final Core Cup functionality task; interactive UI polish pass remains (per founder: "do some changes interactively, once the functionalities land").
- **Unresolved issues:** Handoff mechanism resolved — `user-opens-official-channel` (recorded in Decision 0014): server records the recovery acknowledgement + private `authority-report` list entry, then the human opens the simulated official channel; the app never submits or confirms receipt.
