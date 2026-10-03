# DSN-010: Completed Demo Bank verification

- **Scope:** core
- **Priority:** P0
- **Owner:** DSN-010 implementer subagent (serialized under integrator)
- **Branch/worktree:** `task/DSN-010-demo-bank-verification` @ `.worktrees/dsn-010-demo-bank-verification`
- **Owned paths:** `apps/api/src/{demo-bank-registry,verification,verification-routes}.ts`, `apps/api/test/verification.test.ts`, `apps/web/src/{VerifyPanel,VerifyPanel.test}.tsx`
- **Dependencies:** DSN-009 (done @ fe7b8bb; also DSN-003 @ e560d2d, DSN-007 @ e9f9aea, DSN-008 @ 611f85b)
- **PRD references:** C7 Demo Bank verification; C9
- **Decision references:** 0001
- **Started:** 2026-10-03

## Outcome

Versioned fictional Demo Bank registry is the only actionable route; completed simulated verification records provenance; caller-supplied contacts rejected. See plan Task 8 (DSN-010). UI frames 04, 05.

## Boundaries

- Included: `DEMO_BANK_REGISTRY`, `VerificationResult`/`VerificationProjection`, `verifyWithDemoBank`, VerifyPanel, verify + registry routes.
- Excluded: ally review (DSN-011). Caller text never supplies route/response. Persistent **Simulated**; no real callback/number authoritative.

## Acceptance checks

- [x] Only actionable route is versioned fictional registry; caller-provided contacts rejected (400); result records registryVersion/method/time/**Simulated**.
- [x] After **cancel**, same case durably records rejected Demo Bank claim + cancelled simulated transfer, `phase === 'Resolve'`; persistent label, no real-bank claim. (Scope note: the implemented and tested resolution is `cancel`; `defer` as a *distinct* terminal command does not exist in `payment.ts`/`decision-routes.ts` and is carried forward as a founder product decision — see Limitations and Handoff.)
- [x] Red→green per plan Task 8 (web side strictly red-first; API-side TDD-ordering deviation disclosed under Limitations); `test:api -- verification.test.ts` + `test:web -- VerifyPanel.test.tsx` + `typecheck` pass; `git diff --check` clean.

A task may move to `done` only after every applicable acceptance check is marked complete, the change is integrated, and post-integration verification is recorded below.

## Verification evidence

- **Commits (branch `task/DSN-010-demo-bank-verification`):**
  - `6b1c985` DSN-010: claim completed Demo Bank verification
  - `ad5ce3f` DSN-010: add completed Demo Bank verification workflow (implementer)
  - `71ac160` DSN-010: record verification evidence and carry-forwards
  - `e6f3ef7` DSN-010: remove dead Defer control from VerifyPanel (scoped fix after review — removed the unwired `onDefer` prop/button, replaced with a code comment that defer has no backend `defer` command / `deferred` PaymentState and must only be re-added with a backend if the founder approves)
- **Review/fix narrative:** Independent read-only reviewer adjudicated two items non-blocking: (a) the API-side TDD-ordering deviation (impl drafted before tests) was confirmed substantive via run + mutation reasoning; (b) the "defer" acceptance-text gap — PRD line 254 treats `defer` as a first-class payment command and C9 says "cancelled/deferred", but no `deferred` PaymentState and no `defer` command exist; reviewer ruled C9's primary path satisfied by `cancel`, and defer out of DSN-010's scope (lives in serialized `payment.ts`/`decision-routes.ts`). Checkbox #2 was overclaimed ("cancel/defer") → reworded to cancel-only; `onDefer` was a dead control → removed in `e6f3ef7`. Surfaced to founder as a product decision (below).
- **Integration commit:** `e8b9822` DSN-010: integrate completed Demo Bank verification (integrator `--no-ff` merge of `task/DSN-010-demo-bank-verification` into local `main`)
- **Commands and results:**
  - `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test -- verification.test.ts'` → 17/17 passed (red confirmed first: ran against the not-yet-written test file before implementation existed... actually implementation files were drafted first — see Limitations below for the TDD-ordering deviation).
  - `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test'` → full suite 225/225 passed (baseline 208 + 17 new; no regressions).
  - `npm --workspace apps/web run test -- VerifyPanel.test.tsx` → red confirmed first (`Failed to resolve import "./VerifyPanel"`), then 12/12 passed after implementation (two assertions adjusted from `getByText` to `getAllByText(...).length >= N` once ambiguous duplicate "Simulated"/"cup-1" text was discovered across the registry-provenance header and the completed-result block — both are intentional, not a bug).
  - `npm --workspace apps/web run test` → full suite 70/70 passed (baseline 58 + 12 new; no regressions).
  - `npm run typecheck` (workspaces: contracts, api, web) → clean, no errors.
  - `git diff --check --cached` → clean (no whitespace/conflict-marker issues).
  - `git status --porcelain` → only the six owned files touched (confirmed both before and after commit).
  - Hygiene grep (`sfdc|salesforce|chander|@salesforce|/Users/|secret|password|apikey|api_key`, case-insensitive) across all six new files → no matches.
- **Post-integration verification (on local `main` at `e8b9822`):**
  - `npm run typecheck` (contracts, api, web) → clean, no errors.
  - `npx firebase emulators:exec --project demo-dsn --only auth,firestore 'npm --workspace apps/api run test'` → **225/225** passed (10 test files).
  - `npm --workspace apps/web run test` → **71/71** passed (6 test files). (Web count settled at 71 after the `e6f3ef7` dead-Defer removal adjusted VerifyPanel coverage; the worker-record "70/70" was pre-fix.)
  - `git diff --check` → clean.
  - Hygiene scan (`sfdc|salesforce|chander|@salesforce|/Users/|secret|password|apikey|api_key`, case-insensitive) across the six owned files → no matches.
- **Changed paths:**
  - `apps/api/src/demo-bank-registry.ts` (new) — `DEMO_BANK_REGISTRY`, versioned/fictional, the only actionable verification route.
  - `apps/api/src/verification.ts` (new) — `VerificationResult`, `VerificationProjection`, `verifyWithDemoBank` (one-shot, idempotent via a deterministic per-case key; phase advances only through the shared `transition()` table).
  - `apps/api/src/verification-routes.ts` (new) — `createVerificationRoutes()`: `POST /api/v1/cases/:id/verify` (empty `.strict()` body schema rejects any caller-supplied field, e.g. a phone number, with 400) and `GET /api/v1/registry/demo-bank`. Not mounted into `app.ts` (see carry-forward below).
  - `apps/api/test/verification.test.ts` (new) — 17 tests: core `verifyWithDemoBank` behavior (provenance, Check→Verify, Pause→Verify leaving `paymentState`/`reasons` untouched, Verify→Verify no-op, `ILLEGAL_TRANSITION` from Observe, idempotency/no double-write, `FORBIDDEN`, `PLAN_REQUIRED`, `UNKNOWN_BANK`), the C9 resolution path (verify then `act(...'cancel'...)` → `phase === 'Resolve'`), and HTTP route tests (401/400/403/200/409 cases plus the registry GET route).
  - `apps/web/src/VerifyPanel.tsx` (new) — presentational-only component; props `registry`/`result?`/`onVerify?`/`onCancel?` (the `onDefer?` prop/button was removed in `e6f3ef7` as a dead control); never calls Firestore/API/model directly; persistent "Simulated" labeling; never renders a free-text contact field.
  - `apps/web/src/VerifyPanel.test.tsx` (new) — 12 tests mirroring the plan's literal red-test snippet plus pending/completed render-mode coverage, callback firing, and negative assertions (no textbox/contact field, no scam-probability/mental-state copy).
  - This task record (`project/tasks/in-progress/DSN-010-demo-bank-verification.md`).
- **Limitations or skipped checks:**
  - **TDD ordering deviation:** implementation files (`demo-bank-registry.ts`, `verification.ts`, `verification-routes.ts`) were drafted before `verification.test.ts` was written, due to a mid-session continuation boundary. The API test file was still written against the plan's interfaces independently and ran green on the first try (17/17) without any adjustment to the implementation — so the tests did genuinely exercise and pass against independently-derived assertions, but strict red→green ordering was not followed for the API side. The web side (`VerifyPanel.tsx`/`.test.tsx`) did follow strict red→green: the test file was written first, confirmed red (missing module), then the component was written and the two ambiguous-text assertions were adjusted to green.
  - **"Defer" is not a distinct, separately-tested resolution path.** `payment.ts`'s `PaymentState` union (`'draft'|'pending'|'paused'|'cancelled'|'continued'`) has no `'deferred'` value, and `decision-routes.ts`'s `act()` only supports `pause`/`cancel`/`verify`/`continue` — there is no `defer` command. I read the acceptance text's "cancelled/deferred simulated transfer" as a colloquial pairing describing one terminal outcome (the transfer does not proceed), not two independently Resolve-reaching mechanisms, and `verification.test.ts`'s C9 test only exercises the `cancel` path end-to-end (verify → `act(...'cancel'...)` → `phase === 'Resolve'`, both outcomes durably recorded on one case). `VerifyPanel.tsx` originally exposed an `onDefer` callback as a presentational affordance (mirroring wireframe copy); because it was **not wired to or tested against any backend command** (no `defer` command / `deferred` PaymentState exists, and `payment.ts`/`decision-routes.ts` are out of this task's scope), the integrator-scoped fix `e6f3ef7` **removed** it to avoid shipping a dead control, leaving a code comment that it must only return with a real backend command if the founder approves. Whether Core MVP needs a `defer` resolution distinct from `cancel` is carried forward as a founder product decision (see Handoff).
  - Visual/CSS styling, touch-target sizing, and i18n are out of scope, matching `PaymentPanel.tsx`/`ActionConsole.tsx`'s own unstyled precedent.

## Blocker or deferral

Not applicable — task complete within its owned scope and integrated at `e8b9822`; three items are carried forward (not blockers on this task's own acceptance), listed under Handoff: route mounting (DSN-014), the `defer` founder product decision, and the `deriveConversationSignals` `unverified` carry-forward.

## Handoff

- **Next action (integrator, DSN-014 or equivalent):**
  1. **Route mounting (DSN-014).** `createVerificationRoutes()` is deliberately not mounted into `apps/api/src/app.ts` (that file is serialized/off-limits to this task). The integrator must add it to whatever `buildApi([...])` call assembles the real public app, alongside the other feature route installers.
  2. **Founder product decision — distinct `defer` resolution?** No backend command currently exists for "defer" distinct from "cancel" (`PaymentState` has no `deferred`; `act()` has no `defer`), yet PRD line 254 / C9 reference "deferred". Dead `onDefer` control already removed (`e6f3ef7`). If the founder decides Core MVP needs a distinct defer, it requires: `deferred` added to the `PaymentState` union in `packages/contracts` + a `defer` command in `decision-routes.ts` (both serialized) + a `project/decisions/` entry — not a silent inference.
  3. **Carry-forward assessment (not implemented, flagged only):** `apps/api/src/payment.ts`'s `deriveConversationSignals` hardcodes `unverified: true` unconditionally (confirmed by reading that function — it never reads the case's `verification` field at all). Now that `verifyWithDemoBank` exists and records a completed, provenance-bearing result, there is a plausible case that a case with a recorded `verification.simulated === true` result (i.e., the Demo Bank claim was checked and rejected) should feed back into that signal — e.g. `unverified` could become conditional on whether a verification result exists and what it found, rather than always `true`. I did **not** implement this: `payment.ts` is serialized/off-limits to DSN-010, and changing a signal that feeds `policy.ts`'s `assessCase`/`isJoined` is a product-policy decision, not a pure plumbing one (it could change when a case reaches Pause at all). This needs a founder/architecture-decision call, not a silent code change, and should probably be recorded in `project/decisions/` before anyone touches `payment.ts` for it.
- **Unresolved issues:** None beyond the three carry-forwards above.
