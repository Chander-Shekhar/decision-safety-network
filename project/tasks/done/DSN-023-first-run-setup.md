# DSN-023: First-run setup flow

- **Scope:** core
- **Priority:** P1
- **Owner:** Orchestrator (subagent-driven implementer under integrator)
- **Branch/worktree:** `task/DSN-023-first-run-setup` (isolated worktree)
- **Owned paths:** `apps/web/src/**`, `apps/api/src/plan*`, `packages/contracts/src/plan.ts`. Serialized/not owned: no session/screening/recovery/ally modules.
- **Dependencies:** DSN-022 (design system) — integrated at `1bfd4d2`.
- **PRD references:** Part I — C1 Decision Safety Plan; Fixed scope; three-minute demo beat 0:00
- **Decision references:** 0010
- **Started:** 2026-10-11
- **Last updated:** 2026-10-11

## Outcome

A guided first-run setup a new user completes and lands configured on home: (1) call-listening preference — all calls / unverified numbers only / decide per call at pickup; (2) ally + what case info to share; (3) bank account(s) registered for later guided protection. Extends the existing plan model/contract.

## Boundaries

- Included: home/empty state, setup steps, persistence through the plan API, "configured home" landing.
- Excluded: the actual call capture (DSN-025), caller screening (DSN-024), real bank linking (guided only, DSN-027).

## Acceptance checks

- [x] A fresh user with no plan is routed into setup; completing it persists the preferences and lands on a configured home. — `GET /plan` 404 ⇒ fresh; 3-step `SetupScreen` → `PUT /plan` with `completeSetup` stamps `setupCompletedAt`; lands on `HomeScreen`. HTTP test covers 404 → PUT → configured GET.
- [x] Call-listening preference persists and is readable by the screening/session flow. — `callListening` (`all-calls`/`unverified-only`/`per-call`) on the `Plan` contract, retrievable via `normalizePlan`/`getPlan`/`GET /plan`; v1 docs normalize to `per-call`.
- [x] Web + API suites green; typecheck clean; contract change additive and versioned. — `PLAN_CONTRACT_VERSION = 2`, new fields only, no existing field changed; omitted fields on save fall back to stored values (tested).

## Verification evidence

- **Commits:** `f31bb3b` (plan contract v2 + `GET /plan`), `cec56c4` (setup wizard + home + routing), `5f8296b` (nit-1 fix: only 404 is a fresh user, retry on other load errors) on `task/DSN-023-first-run-setup`.
- **Integration commit:** `fbc62b8` — `git merge --no-ff` into local `main` (not pushed).
- **Commands and results:** `npm run typecheck` clean (contracts/api/web). `npm --workspace apps/web run test` → 155/155 (16 files). API suite via `firebase emulators:exec --only auth,firestore` (JDK 21) → 361/361 (16 files).
- **Post-integration verification:** All three rerun on merged `main` (`fbc62b8`): typecheck clean, web 155/155, API 361/361.
- **Independent review:** `dsn023-review` (fresh agent, read-only) — verdict READY TO INTEGRATE, no blocking items; confirmed routing/persistence, downstream-readable preference, additive/versioned contract, honesty, scope, deep links. Nit 1 fixed pre-merge; nits 2–6 deferred.
- **Changed paths:** `packages/contracts/src/plan.ts`; `apps/api/src/{plan.ts,plan-routes.ts}`; `apps/api/test/plan-setup.test.ts` (new); `apps/web/src/{App.tsx,App.test.tsx,SetupScreen.tsx,SetupScreen.test.tsx,HomeScreen.tsx}` (3 new). No out-of-scope edits.
- **Limitations or skipped checks:** Playwright e2e (`test:e2e`) not run. `allyShareFields` is persisted but not yet consumed (future ally-grant work). Visual walkthrough is a founder action.

## Deferred follow-ups (non-blocking, for the interactive polish pass)

- Nit 2: existing v1 plan holders pass through setup once (prefilled) — acceptable.
- Nit 3: `HomeScreen` "You're protected" title can read as overclaim when consent is off or ally unpaired — soften copy.
- Nit 4: `plan-routes.ts` casts loosen zod enum types; `allyShareFields` allows duplicates — tighten with `z.enum`/uniqueness.
- Nit 5: ally pairing not atomic with plan save — retryable from Safety Plan; acceptable.
- Nit 6: client-generated account ids, length-checked only — fine for demo.
- Founder decision: transcript-processing consent defaults OFF (safe, PRD-aligned); consider defaulting ON for the demo.

## Blocker or deferral

Not applicable.

## Handoff

- **Next action:** Integrated and done. Downstream screening/session (DSN-024/025) reads the call-listening preference via `getPlan`/`normalizePlan`.
- **Unresolved issues:** None blocking; see deferred follow-ups above.
